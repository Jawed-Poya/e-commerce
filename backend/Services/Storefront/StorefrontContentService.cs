using System.Text.Json;
using ECommerce.Data;
using ECommerce.Entities.Storefront;
using ECommerce.Entities.Storefront.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ECommerce.Services.Storefront;

public sealed class StorefrontContentService(
    ApplicationDbContext context,
    IWebHostEnvironment environment,
    IMemoryCache cache) : IStorefrontContentService
{
    private const string CacheKey = "storefront:content";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

    public async Task<StorefrontContentResponse> GetAsync(CancellationToken cancellationToken = default)
    {
        if (cache.TryGetValue<StorefrontContentResponse>(CacheKey, out var cached) && cached is not null)
            return cached;

        var entity = await context.StorefrontContents
            .AsNoTracking()
            .OrderBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);
        var response = entity is null ? DefaultContent() : Map(entity);
        cache.Set(CacheKey, response, TimeSpan.FromMinutes(5));
        return response;
    }

    public async Task<StorefrontContentResponse> UpdateAsync(
        UpdateStorefrontContentRequest request,
        CancellationToken cancellationToken = default)
    {
        Validate(request);
        var entity = await context.StorefrontContents
            .OrderBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null)
        {
            entity = new StorefrontContent { CreatedAt = DateTime.UtcNow };
            context.StorefrontContents.Add(entity);
        }

        entity.HeroImageUrl = Clean(request.HeroImageUrl);
        entity.PrimaryButtonUrl = NormalizeInternalUrl(request.PrimaryButtonUrl, "/products");
        entity.SecondaryButtonUrl = NormalizeInternalUrl(request.SecondaryButtonUrl, "/products?featured=true");
        entity.HeroContentJson = JsonSerializer.Serialize(
            new HeroTranslations(request.En, request.Ps, request.Dr),
            JsonOptions);
        entity.UpdatedAt = DateTime.UtcNow;
        entity.IsActive = true;

        await context.SaveChangesAsync(cancellationToken);
        cache.Remove(CacheKey);
        return Map(entity);
    }

    public async Task<string> SaveHeroImageAsync(
        IFormFile image,
        CancellationToken cancellationToken = default)
    {
        if (image.Length <= 0 || image.Length > 8 * 1024 * 1024)
            throw new ArgumentException("Hero image must be between 1 byte and 8 MB.");

        var extension = Path.GetExtension(image.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("Use a JPG, PNG, WebP, or AVIF hero image.");

        var root = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
        var directory = Path.Combine(root, "uploads", "storefront");
        Directory.CreateDirectory(directory);
        var fileName = $"hero-{Guid.NewGuid():N}{extension}";
        var path = Path.Combine(directory, fileName);

        await using var stream = File.Create(path);
        await image.CopyToAsync(stream, cancellationToken);
        return $"/uploads/storefront/{fileName}";
    }

    private static StorefrontContentResponse Map(StorefrontContent entity)
    {
        HeroTranslations translations;
        try
        {
            translations = JsonSerializer.Deserialize<HeroTranslations>(
                entity.HeroContentJson,
                JsonOptions) ?? DefaultTranslations();
        }
        catch (JsonException)
        {
            translations = DefaultTranslations();
        }

        return new StorefrontContentResponse(
            entity.HeroImageUrl,
            entity.PrimaryButtonUrl,
            entity.SecondaryButtonUrl,
            translations.En,
            translations.Ps,
            translations.Dr,
            entity.UpdatedAt);
    }

    private static StorefrontContentResponse DefaultContent()
    {
        var translations = DefaultTranslations();
        return new StorefrontContentResponse(
            null,
            "/products",
            "/products?featured=true",
            translations.En,
            translations.Ps,
            translations.Dr,
            null);
    }

    private static HeroTranslations DefaultTranslations() => new(
        new LocalizedHeroContent(
            "A better way to shop",
            "Everything you need, carefully selected.",
            "Explore current prices, live inventory, customer-specific offers, and reliable delivery from one clean storefront.",
            "Shop now",
            "Featured products"),
        new LocalizedHeroContent(
            "د پېرودلو غوره لاره",
            "هر څه چې تاسو ورته اړتیا لرئ، په پام سره ټاکل شوي.",
            "اوسني نرخونه، ژوندی موجودي، ځانګړي وړاندیزونه او باوري سپارنه په یوه پاک پلورنځي کې وګورئ.",
            "اوس پېرود وکړئ",
            "ځانګړي محصولات"),
        new LocalizedHeroContent(
            "راه بهتر برای خرید",
            "هر آنچه نیاز دارید، با دقت انتخاب شده است.",
            "قیمت‌های فعلی، موجودی زنده، پیشنهادهای ویژه و تحویل مطمئن را در یک فروشگاه ساده مشاهده کنید.",
            "خرید کنید",
            "محصولات ویژه"));

    private static void Validate(UpdateStorefrontContentRequest request)
    {
        foreach (var content in new[] { request.En, request.Ps, request.Dr })
        {
            if (string.IsNullOrWhiteSpace(content.Title) || content.Title.Trim().Length > 160)
                throw new ArgumentException("Every language needs a hero title of at most 160 characters.");
            if (string.IsNullOrWhiteSpace(content.Description) || content.Description.Trim().Length > 600)
                throw new ArgumentException("Every language needs a hero description of at most 600 characters.");
            if (string.IsNullOrWhiteSpace(content.PrimaryButtonText) ||
                string.IsNullOrWhiteSpace(content.SecondaryButtonText))
                throw new ArgumentException("Every language needs both hero button labels.");
        }
    }

    private static string NormalizeInternalUrl(string? value, string fallback)
    {
        var clean = Clean(value);
        return clean is not null && clean.StartsWith('/') && !clean.StartsWith("//")
            ? clean
            : fallback;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record HeroTranslations(
        LocalizedHeroContent En,
        LocalizedHeroContent Ps,
        LocalizedHeroContent Dr);
}
