using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using sunsteel.api.Common.Health;
using sunsteel.api.Common.Middleware;
using sunsteel.api.Common.Security;
using sunsteel.api.Data;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Auth;
using sunsteel.api.Features.Catalog;
using sunsteel.api.Features.Auth.Services;
using sunsteel.api.Features.Identity;
using sunsteel.api.Features.Leads;
using sunsteel.api.Features.Site;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// --- Logging -------------------------------------------------------------
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

// --- Core ----------------------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddOpenApi();

const string WebCors = "WebCors";
var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200"];
builder.Services.AddCors(o => o.AddPolicy(WebCors, p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not set.");
// A fixed server version (rather than AutoDetect) lets the API start, and report itself
// unhealthy at /api/health/ready, even when MySQL is down.
builder.Services.AddDbContext<SunSteelDbContext>(o =>
    o.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));

// --- Auth ----------------------------------------------------------------
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddHostedService<SuperAdminSeeder>();

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
if (Encoding.UTF8.GetByteCount(jwt.Key) < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 bytes. Set it with user-secrets or the Jwt__Key environment variable.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

// One policy per permission code; the JWT carries them as "perm" claims.
builder.Services.AddAuthorization(o =>
{
    foreach (var code in Perm.All)
        o.AddPolicy(code, p => p.RequireAuthenticatedUser().RequireClaim(Perm.ClaimType, code));
});

// --- Features --------------------------------------------------------------
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IStaffUserService, StaffUserService>();
builder.Services.AddScoped<ISiteService, SiteService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<ILeadService, LeadService>();
builder.Services.AddScoped<sunsteel.api.Features.Quotes.IQuoteService, sunsteel.api.Features.Quotes.QuoteService>();
builder.Services.AddScoped<sunsteel.api.Features.Quotes.IQuoteDataService, sunsteel.api.Features.Quotes.QuoteDataService>();
builder.Services.AddScoped<sunsteel.api.Features.Quotes.ICustomerService, sunsteel.api.Features.Quotes.CustomerService>();
builder.Services.AddScoped<sunsteel.api.Features.Analytics.IAnalyticsService, sunsteel.api.Features.Analytics.AnalyticsService>();
builder.Services.AddScoped<sunsteel.api.Features.Media.IMediaService, sunsteel.api.Features.Media.MediaService>();
builder.Services.AddScoped<sunsteel.api.Features.Gallery.IGalleryService, sunsteel.api.Features.Gallery.GalleryService>();
builder.Services.AddScoped<sunsteel.api.Features.Slides.ISlideService, sunsteel.api.Features.Slides.SlideService>();

// --- Platform ------------------------------------------------------------
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// Anonymous public reads are cached for 5 minutes and evicted by tag whenever an admin
// saves, so edits show immediately without hammering MySQL on every page view.
builder.Services.AddOutputCache(o =>
    o.AddPolicy("public", b => b.Expire(TimeSpan.FromMinutes(5)).Tag(SiteController.CacheTag).SetVaryByQuery("*")));

builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    o.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Sign-in endpoints: 10 per minute per IP.
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    // Page-view beacon: 120 per minute per IP, plenty for browsing and too little to flood the table.
    o.AddPolicy("track", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    // Public RFQ / catalogue / contact forms: 10 per hour per IP.
    o.AddPolicy("enquiry", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));
});

var app = builder.Build();

// --- Pipeline ------------------------------------------------------------
app.UseForwardedHeaders();
app.UseResponseCompression();

app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment()) app.MapOpenApi();
else app.UseHsts();

// Uploaded media. In production Nginx serves /uploads directly; this covers development.
var uploadPath = builder.Configuration["Media:UploadPath"] ?? "uploads";
var mediaRoot = Path.IsPathRooted(uploadPath) ? uploadPath : Path.Combine(app.Environment.ContentRootPath, uploadPath);
Directory.CreateDirectory(mediaRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = builder.Configuration["Media:RequestPath"] ?? "/uploads",
});

app.UseCors(WebCors);
app.UseOutputCache();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/api/health/ready");

app.Run();
