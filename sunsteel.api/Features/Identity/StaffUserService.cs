using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Auth.Services;

namespace sunsteel.api.Features.Identity;

public interface IStaffUserService
{
    Task<IReadOnlyList<StaffUserDto>> ListAsync(CancellationToken ct = default);
    Task<IReadOnlyList<RoleDto>> ListRolesAsync(CancellationToken ct = default);
    Task<StaffUserDto> CreateAsync(long actorId, CreateStaffUserRequest req, CancellationToken ct = default);
    Task<StaffUserDto> UpdateAsync(long actorId, long userId, UpdateStaffUserRequest req, CancellationToken ct = default);
    Task ResetPasswordAsync(long actorId, long userId, string temporaryPassword, CancellationToken ct = default);
}

/// <summary>
/// Each staff user holds exactly one role (Super Admin, Manager or Staff) — simpler
/// for a small sales team than the many-to-many the schema allows. Guards stop the last active
/// Super Admin from being demoted or disabled, which would lock everyone out of this screen.
/// </summary>
public sealed class StaffUserService : IStaffUserService
{
    private const int MinPasswordLength = 8;
    private const string SuperAdmin = "SUPER ADMIN";

    private readonly SunSteelDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditService _audit;

    public StaffUserService(SunSteelDbContext db, IPasswordHasher hasher, IAuditService audit)
    {
        _db = db;
        _hasher = hasher;
        _audit = audit;
    }

    public async Task<IReadOnlyList<StaffUserDto>> ListAsync(CancellationToken ct = default)
    {
        var users = await _db.Users.AsNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .OrderBy(u => u.FullName ?? u.Email)
            .ToListAsync(ct);
        return users.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<RoleDto>> ListRolesAsync(CancellationToken ct = default)
    {
        var roles = await _db.Roles.AsNoTracking()
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .OrderBy(r => r.RoleId)
            .ToListAsync(ct);
        return roles.Select(r => new RoleDto(r.RoleId, r.Name, r.Description,
            r.RolePermissions.Select(rp => rp.Permission!.Code).OrderBy(c => c).ToList())).ToList();
    }

    public async Task<StaffUserDto> CreateAsync(long actorId, CreateStaffUserRequest req, CancellationToken ct = default)
    {
        var email = (req.Email ?? "").Trim();
        if (email.Length == 0 || !email.Contains('@')) throw new AppException("Enter a valid email address.");
        ValidatePassword(req.TemporaryPassword);
        var role = await RequireRoleAsync(req.RoleId, ct);

        var normalized = email.ToUpperInvariant();
        if (await _db.Users.AnyAsync(u => u.NormalizedEmail == normalized, ct))
            throw new AppException("A staff user with this email already exists.", StatusCodes.Status409Conflict);

        var user = new User
        {
            Email = email,
            NormalizedEmail = normalized,
            FullName = Clean(req.FullName),
            PhoneNumber = Clean(req.PhoneNumber),
            PasswordHash = _hasher.Hash(req.TemporaryPassword),
            MustChangePassword = true,
            AllowGoogleSignIn = req.AllowGoogleSignIn,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        user.UserRoles.Add(new UserRole { RoleId = role.RoleId });
        _db.Users.Add(user);
        _audit.Record(actorId, "Create", "User", null, $"{email} as {role.Name}");
        await _db.SaveChangesAsync(ct);

        user.UserRoles.First().Role = role;
        return ToDto(user);
    }

    public async Task<StaffUserDto> UpdateAsync(long actorId, long userId, UpdateStaffUserRequest req, CancellationToken ct = default)
    {
        var user = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId, ct)
            ?? throw new AppException("Staff user not found.", StatusCodes.Status404NotFound);
        var role = await RequireRoleAsync(req.RoleId, ct);

        if (userId == actorId && !req.IsActive)
            throw new AppException("You can't disable your own account.");

        var wasSuper = user.UserRoles.Any(ur => ur.Role?.NormalizedName == SuperAdmin);
        var staysSuper = role.NormalizedName == SuperAdmin && req.IsActive;
        if (wasSuper && user.IsActive && !staysSuper)
        {
            var otherSupers = await _db.UserRoles.CountAsync(ur =>
                ur.Role!.NormalizedName == SuperAdmin && ur.UserId != userId && ur.User!.IsActive, ct);
            if (otherSupers == 0)
                throw new AppException("Keep at least one active Super Admin, or no one can manage staff users.");
        }

        user.FullName = Clean(req.FullName);
        user.PhoneNumber = Clean(req.PhoneNumber);
        user.AllowGoogleSignIn = req.AllowGoogleSignIn;
        user.UpdatedAt = DateTime.UtcNow;

        if (user.IsActive && !req.IsActive) await RevokeSessionsAsync(userId, ct);
        user.IsActive = req.IsActive;

        if (user.UserRoles.All(ur => ur.RoleId != role.RoleId))
        {
            _db.UserRoles.RemoveRange(user.UserRoles);
            user.UserRoles.Clear();
            user.UserRoles.Add(new UserRole { UserId = userId, RoleId = role.RoleId, Role = role });
            // Permissions live in the access token; end sessions so the new role applies now.
            await RevokeSessionsAsync(userId, ct);
        }

        _audit.Record(actorId, "Update", "User", userId.ToString(), $"{user.Email}: {role.Name}, active={req.IsActive}");
        await _db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task ResetPasswordAsync(long actorId, long userId, string temporaryPassword, CancellationToken ct = default)
    {
        ValidatePassword(temporaryPassword);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId, ct)
            ?? throw new AppException("Staff user not found.", StatusCodes.Status404NotFound);

        user.PasswordHash = _hasher.Hash(temporaryPassword);
        user.MustChangePassword = true;
        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        user.UpdatedAt = DateTime.UtcNow;
        await RevokeSessionsAsync(userId, ct);
        _audit.Record(actorId, "ResetPassword", "User", userId.ToString(), user.Email);
        await _db.SaveChangesAsync(ct);
    }

    // --- helpers ---

    private async Task<Role> RequireRoleAsync(long roleId, CancellationToken ct) =>
        await _db.Roles.FirstOrDefaultAsync(r => r.RoleId == roleId, ct)
        ?? throw new AppException("Choose a valid role.");

    private async Task RevokeSessionsAsync(long userId, CancellationToken ct)
    {
        foreach (var t in await _db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync(ct))
            t.RevokedAt = DateTime.UtcNow;
    }

    private static void ValidatePassword(string? password)
    {
        if ((password ?? "").Length < MinPasswordLength)
            throw new AppException($"Temporary passwords need at least {MinPasswordLength} characters.");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static StaffUserDto ToDto(User u)
    {
        var role = u.UserRoles.Select(ur => ur.Role).FirstOrDefault(r => r is not null);
        return new StaffUserDto(u.UserId, u.Email, u.FullName, u.PhoneNumber, role?.RoleId, role?.Name,
            u.IsActive, u.AllowGoogleSignIn, u.MustChangePassword, u.LastLoginAt, u.CreatedAt);
    }
}
