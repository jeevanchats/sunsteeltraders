using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using SkiaSharp;

namespace sunsteel.api.Features.Media;

public interface IMediaService
{
    /// <summary>Validates, converts to WebP at several widths, and stores the result.</summary>
    Task<MediaDto> SaveImageAsync(Stream source, string originalName, string? category, string? altText, string? caption, long? actorId, CancellationToken ct = default);
    /// <summary>Stores a short MP4/WebM clip as uploaded (no transcoding) after checking its real file signature.</summary>
    Task<MediaDto> SaveVideoAsync(Stream source, string originalName, string? category, string? altText, string? caption, long? actorId, CancellationToken ct = default);
    Task<PagedResult<MediaDto>> ListAsync(string? category, string? kind, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<MediaDto> UpdateAsync(long actorId, long id, UpdateMediaRequest req, CancellationToken ct = default);
    Task DeleteAsync(long? actorId, long id, CancellationToken ct = default);
}

/// <summary>
/// Image pipeline. Anything uploaded is decoded by SkiaSharp (so the file extension and
/// Content-Type are never trusted), rotated per EXIF, stripped of metadata and re-encoded as
/// WebP at 480/960/1600/2400 px wide (never upscaled). The originals are not kept.
/// </summary>
public sealed class MediaService : IMediaService
{
    public static readonly string[] Categories = ["Products", "Godown", "Team", "Hero", "Catalogue", "General"];

    private static readonly int[] TargetWidths = [480, 960, 1600, 2400];
    private readonly int _webpQuality;
    private const long MaxPixels = 100_000_000;       // blocks decompression bombs

    // Only the formats the admin asks for; anything else the codec could parse is rejected before decoding.
    private static readonly HashSet<SKEncodedImageFormat> AllowedFormats =
        [SKEncodedImageFormat.Jpeg, SKEncodedImageFormat.Png, SKEncodedImageFormat.Webp, SKEncodedImageFormat.Gif, SKEncodedImageFormat.Bmp];

    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;
    private readonly string _root;
    private readonly string _requestPath;
    private readonly long _maxBytes;
    private readonly long _maxVideoBytes;

    public MediaService(SunSteelDbContext db, IAuditService audit, IConfiguration config, IWebHostEnvironment env)
    {
        _db = db;
        _audit = audit;
        var upload = config["Media:UploadPath"] ?? "uploads";
        _root = Path.GetFullPath(Path.IsPathRooted(upload) ? upload : Path.Combine(env.ContentRootPath, upload));
        _requestPath = (config["Media:RequestPath"] ?? "/uploads").TrimEnd('/');
        _maxBytes = config.GetValue<long?>("Media:MaxImageBytes") ?? 26_214_400;
        _maxVideoBytes = config.GetValue<long?>("Media:MaxVideoBytes") ?? 83_886_080;
        _webpQuality = Math.Clamp(config.GetValue<int?>("Media:WebpQuality") ?? 78, 40, 95);
    }

    public async Task<MediaDto> SaveImageAsync(Stream source, string originalName, string? category, string? altText,
        string? caption, long? actorId, CancellationToken ct = default)
    {
        category = NormaliseCategory(category);

        // Buffer (bounded) so the stream can be read twice: once to inspect, once to decode.
        using var buffer = new MemoryStream();
        var limited = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(limited, ct)) > 0)
        {
            buffer.Write(limited, 0, read);
            if (buffer.Length > _maxBytes) throw new AppException($"Image is larger than {_maxBytes / 1024 / 1024} MB.", 413);
        }
        if (buffer.Length == 0) throw new AppException("The file is empty.");

        buffer.Position = 0;
        using var codec = SKCodec.Create(buffer);
        if (codec is null || !AllowedFormats.Contains(codec.EncodedFormat))
            throw new AppException("That file is not a supported image. Use JPG, PNG, WebP, GIF or BMP.");
        if ((long)codec.Info.Width * codec.Info.Height > MaxPixels) throw new AppException("Image dimensions are too large.");

        // Decode first frame only; re-encoding below drops EXIF / XMP / ICC, so the metadata is never kept.
        using var decoded = SKBitmap.Decode(codec);
        if (decoded is null) throw new AppException("That file is not a supported image. Use JPG, PNG, WebP, GIF or BMP.");
        using var image = AutoOrient(decoded, codec.EncodedOrigin);

        var now = DateTime.UtcNow;
        var folder = Path.Combine(now.ToString("yyyy"), now.ToString("MM"));
        Directory.CreateDirectory(Path.Combine(_root, folder));
        var stem = Guid.NewGuid().ToString("N")[..12];

        var widths = TargetWidths.Where(w => w < image.Width).Append(Math.Min(image.Width, TargetWidths[^1])).Distinct().Order().ToArray();
        var variants = new Dictionary<int, string>();
        long total = 0;
        var written = new List<string>();
        try
        {
            foreach (var w in widths)
            {
                var file = $"{stem}-{w}.webp";
                var full = Path.Combine(_root, folder, file);
                await File.WriteAllBytesAsync(full, EncodeWebp(image, w, _webpQuality), ct);
                written.Add(full);
                total += new FileInfo(full).Length;
                variants[w] = $"{_requestPath}/{now:yyyy}/{now:MM}/{file}";
            }
        }
        catch
        {
            foreach (var f in written) TryDelete(f);   // don't leave half a set behind
            throw;
        }

        var (w0, h0) = (image.Width, image.Height);
        var largest = variants[widths[^1]];
        var asset = new MediaAsset
        {
            Kind = "image",
            FileName = Path.GetFileName(originalName).Truncate(255),
            OriginalUrl = largest,
            VariantsJson = JsonSerializer.Serialize(variants),
            Placeholder = MakePlaceholder(image),
            Width = w0,
            Height = h0,
            SizeBytes = total,
            AltText = Clean(altText, 300),
            Caption = Clean(caption, 300),
            Category = category,
            UploadedBy = actorId,
            CreatedAt = now,
        };
        _db.MediaAssets.Add(asset);
        if (actorId is { } a) _audit.Record(a, "Upload", "Media", null, $"{asset.FileName} ({category ?? "no category"})");
        await _db.SaveChangesAsync(ct);
        return ToDto(asset);
    }

    public async Task<MediaDto> SaveVideoAsync(Stream source, string originalName, string? category, string? altText,
        string? caption, long? actorId, CancellationToken ct = default)
    {
        category = NormaliseCategory(category);

        var now = DateTime.UtcNow;
        var folder = Path.Combine("videos", now.ToString("yyyy"), now.ToString("MM"));
        Directory.CreateDirectory(Path.Combine(_root, folder));
        var stem = Guid.NewGuid().ToString("N")[..12];

        // Stream to a temp name first so a bad or oversized file never lands under its final name.
        var temp = Path.Combine(_root, folder, stem + ".part");
        string ext;
        long size = 0;
        try
        {
            await using (var file = File.Create(temp))
            {
                var buf = new byte[81920];
                int n;
                while ((n = await source.ReadAsync(buf, ct)) > 0)
                {
                    size += n;
                    if (size > _maxVideoBytes) throw new AppException($"Video is larger than {_maxVideoBytes / 1024 / 1024} MB. Compress it first (1080p, 10-20 seconds, no sound is plenty).", 413);
                    await file.WriteAsync(buf.AsMemory(0, n), ct);
                }
            }
            if (size == 0) throw new AppException("The file is empty.");

            // Trust the bytes, not the file name: MP4/MOV carry "ftyp" at offset 4, WebM starts with the EBML magic.
            var head = new byte[12];
            await using (var f = File.OpenRead(temp)) _ = await f.ReadAsync(head, ct);
            if (head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p') ext = ".mp4";
            else if (head[0] == 0x1A && head[1] == 0x45 && head[2] == 0xDF && head[3] == 0xA3) ext = ".webm";
            else throw new AppException("That file is not an MP4 or WebM video.");

            File.Move(temp, Path.Combine(_root, folder, stem + ext));
        }
        catch
        {
            TryDelete(temp);
            throw;
        }

        var url = $"{_requestPath}/{folder.Replace(Path.DirectorySeparatorChar, '/')}/{stem}{ext}";
        var asset = new MediaAsset
        {
            Kind = "video",
            FileName = Path.GetFileName(originalName).Truncate(255),
            OriginalUrl = url,
            SizeBytes = size,
            AltText = Clean(altText, 300),
            Caption = Clean(caption, 300),
            Category = category,
            UploadedBy = actorId,
            CreatedAt = now,
        };
        _db.MediaAssets.Add(asset);
        if (actorId is { } a) _audit.Record(a, "Upload", "Media", null, $"{asset.FileName} (video, {size / 1024} KB)");
        await _db.SaveChangesAsync(ct);
        return ToDto(asset);
    }

    public async Task<PagedResult<MediaDto>> ListAsync(string? category, string? kind, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var q = _db.MediaAssets.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(m => m.Category == category);
        if (kind is "image" or "video") q = q.Where(m => m.Kind == kind);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(m => m.FileName.Contains(s) || (m.AltText != null && m.AltText.Contains(s)) || (m.Caption != null && m.Caption.Contains(s)));
        }
        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.MediaId)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<MediaDto> { Items = rows.Select(ToDto).ToList(), Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<MediaDto> UpdateAsync(long actorId, long id, UpdateMediaRequest req, CancellationToken ct = default)
    {
        var m = await _db.MediaAssets.FirstOrDefaultAsync(x => x.MediaId == id, ct) ?? throw new AppException("Image not found.", 404);
        m.AltText = Clean(req.AltText, 300);
        m.Caption = Clean(req.Caption, 300);
        m.Category = NormaliseCategory(req.Category);
        _audit.Record(actorId, "Update", "Media", id.ToString(), m.FileName);
        await _db.SaveChangesAsync(ct);
        return ToDto(m);
    }

    public async Task DeleteAsync(long? actorId, long id, CancellationToken ct = default)
    {
        var m = await _db.MediaAssets.FirstOrDefaultAsync(x => x.MediaId == id, ct) ?? throw new AppException("Image not found.", 404);
        var urls = ParseVariants(m.VariantsJson).Values.Append(m.OriginalUrl).Distinct().ToList();
        _db.MediaAssets.Remove(m);     // FKs on product images / hero slides / pages set the reference to NULL
        if (actorId is { } a) _audit.Record(a, "Delete", "Media", id.ToString(), m.FileName);
        await _db.SaveChangesAsync(ct);
        foreach (var url in urls) TryDelete(ToDiskPath(url));
    }

    // --- helpers ---

    private static string? MakePlaceholder(SKBitmap image)
    {
        // A ~24 px lossy WebP (a few hundred bytes; a JPEG's fixed header alone is ~600) blurs
        // into a soft colour wash when the browser scales it up.
        foreach (var (w, q) in new[] { (24, 40), (16, 35), (10, 30) })
        {
            var uri = "data:image/webp;base64," + Convert.ToBase64String(EncodeWebp(image, w, q));
            if (uri.Length <= 1500) return uri;
        }
        return null;
    }

    /// <summary>Lossy WebP at the given width (aspect kept, never upscaled by callers).</summary>
    private static byte[] EncodeWebp(SKBitmap image, int width, int quality)
    {
        SKBitmap? resized = null;
        try
        {
            if (width != image.Width)
            {
                var height = Math.Max(1, (int)Math.Round((double)image.Height * width / image.Width));
                resized = image.Resize(new SKImageInfo(width, height, image.ColorType, image.AlphaType),
                    new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear))
                    ?? throw new AppException("That image could not be processed.");
            }
            using var pixmap = (resized ?? image).PeekPixels();
            using var data = pixmap.Encode(new SKWebpEncoderOptions(SKWebpEncoderCompression.Lossy, quality))
                ?? throw new AppException("That image could not be processed.");
            return data.ToArray();
        }
        finally { resized?.Dispose(); }
    }

    /// <summary>Applies the EXIF orientation so the stored pixels are upright.</summary>
    private static SKBitmap AutoOrient(SKBitmap src, SKEncodedOrigin origin)
    {
        if (origin is SKEncodedOrigin.TopLeft or SKEncodedOrigin.Default) return src.Copy();
        int w = src.Width, h = src.Height;
        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        // x' = a*x + b*y + c ; y' = d*x + e*y + f
        var m = origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
            SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
            _ => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),   // LeftBottom
        };
        var dst = new SKBitmap(swap ? h : w, swap ? w : h, src.ColorType, src.AlphaType);
        using var canvas = new SKCanvas(dst);
        canvas.SetMatrix(m);
        canvas.DrawBitmap(src, 0, 0);
        return dst;
    }

    public static MediaDto ToDto(MediaAsset m)
    {
        var variants = ParseVariants(m.VariantsJson);
        return new MediaDto(m.MediaId, m.Kind, m.FileName, m.OriginalUrl, variants, m.Placeholder, m.Width, m.Height,
            m.SizeBytes, m.AltText, m.Caption, m.Category, m.CreatedAt);
    }

    public static IReadOnlyDictionary<int, string> ParseVariants(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<int, string>();
        try { return JsonSerializer.Deserialize<Dictionary<int, string>>(json) ?? new(); }
        catch (JsonException) { return new Dictionary<int, string>(); }
    }

    /// <summary>Maps a /uploads URL back to a file, refusing anything that escapes the upload root.</summary>
    private string ToDiskPath(string url)
    {
        var rel = url.StartsWith(_requestPath + "/", StringComparison.Ordinal) ? url[(_requestPath.Length + 1)..] : url.TrimStart('/');
        var full = Path.GetFullPath(Path.Combine(_root, rel.Replace('/', Path.DirectorySeparatorChar)));
        return full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal) ? full : string.Empty;
    }

    private static void TryDelete(string path)
    {
        if (string.IsNullOrEmpty(path)) return;
        try { File.Delete(path); } catch (IOException) { /* a stray file is harmless; the row is already gone */ }
    }

    private static string? NormaliseCategory(string? c)
    {
        if (string.IsNullOrWhiteSpace(c)) return null;
        return Categories.FirstOrDefault(x => x.Equals(c.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new AppException($"Category must be one of: {string.Join(", ", Categories)}.");
    }

    private static string? Clean(string? s, int max) => string.IsNullOrWhiteSpace(s) ? null : s.Trim().Truncate(max);
}

internal static class StringExtensions
{
    public static string Truncate(this string s, int max) => s.Length <= max ? s : s[..max];
}
