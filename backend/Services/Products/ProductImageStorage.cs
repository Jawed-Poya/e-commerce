namespace ECommerce.Services.Products;

using ECommerce.Options;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

public sealed class LocalProductImageStorage : IProductImageStorage
{
    private readonly IWebHostEnvironment _environment;
    private readonly FileStorageOptions _options;

    public LocalProductImageStorage(
        IWebHostEnvironment environment,
        IOptions<FileStorageOptions> options
    )
    {
        _environment = environment;
        _options = options.Value;
    }

    public Task<StoredProductImage> SaveAsync(
        IFormFile file,
        CancellationToken cancellationToken = default
    ) => SaveAsync(file, "products", cancellationToken);

    public async Task<StoredProductImage> SaveAsync(
        IFormFile file,
        string collection,
        CancellationToken cancellationToken = default
    )
    {
        if (collection is not ("products" or "types" or "company" or "storefront"))
        {
            throw new InvalidOperationException(
                "The image collection is not supported."
            );
        }

        if (file.Length <= 0)
        {
            throw new InvalidOperationException(
                "The uploaded image is empty."
            );
        }

        var maximumSize = Math.Clamp(
            _options.MaximumImageSizeBytes,
            1024L,
            100L * 1024L * 1024L);
        if (file.Length > maximumSize)
        {
            throw new InvalidOperationException(
                $"The image must not exceed {Math.Ceiling(maximumSize / 1024d / 1024d):0} MB."
            );
        }

        var imageType = await DetectImageTypeAsync(
            file,
            cancellationToken
        );

        if (imageType is null)
        {
            throw new InvalidOperationException(
                "Only valid JPG, PNG, WEBP and AVIF images are supported."
            );
        }

        var storageRootPath = GetStorageRootPath();

        var year = DateTime.UtcNow.Year.ToString();
        var month = DateTime.UtcNow.Month.ToString("00");

        var storageRelativeDirectory = Path.Combine(
            collection,
            year,
            month
        );

        var absoluteDirectory = Path.Combine(
            storageRootPath,
            storageRelativeDirectory
        );

        Directory.CreateDirectory(absoluteDirectory);

        var fileName = $"{Guid.NewGuid():N}{imageType.Extension}";

        var absolutePath = Path.Combine(
            absoluteDirectory,
            fileName
        );

        try
        {
            await using var outputStream = new FileStream(
                absolutePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true
            );

            await file.CopyToAsync(
                outputStream,
                cancellationToken
            );
        }
        catch
        {
            if (File.Exists(absolutePath))
            {
                File.Delete(absolutePath);
            }

            throw;
        }

        var publicRelativePath = Path.Combine(
                _options.ResolveRequestPath().Trim('/'),
                storageRelativeDirectory,
                fileName
            )
            .Replace("\\", "/");

        return new StoredProductImage(
            RelativePath: publicRelativePath,
            PublicUrl: $"/{publicRelativePath}",
            FileName: fileName,
            ContentType: imageType.ContentType,
            Size: file.Length
        );
    }

    public Task DeleteAsync(
        string relativePath,
        CancellationToken cancellationToken = default
    )
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return Task.CompletedTask;
        }

        var rootPath = GetStorageRootPath();

        var normalizedRoot = rootPath.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar
        ) + Path.DirectorySeparatorChar;

        var normalizedRelativePath = relativePath
            .Trim()
            .TrimStart('/', '\\')
            .Replace('/', Path.DirectorySeparatorChar);
        var requestPrefix = _options.ResolveRequestPath()
            .Trim('/')
            .Replace('/', Path.DirectorySeparatorChar);
        if (normalizedRelativePath.Equals(requestPrefix, StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;
        if (normalizedRelativePath.StartsWith(
                requestPrefix + Path.DirectorySeparatorChar,
                StringComparison.OrdinalIgnoreCase))
        {
            normalizedRelativePath = normalizedRelativePath[(requestPrefix.Length + 1)..];
        }

        var absolutePath = Path.GetFullPath(
            Path.Combine(
                rootPath,
                normalizedRelativePath
            )
        );

        if (!absolutePath.StartsWith(
                normalizedRoot,
                OperatingSystem.IsWindows()
                    ? StringComparison.OrdinalIgnoreCase
                    : StringComparison.Ordinal
            ))
        {
            throw new InvalidOperationException(
                "Invalid file path."
            );
        }

        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }

        return Task.CompletedTask;
    }

    private string GetStorageRootPath()
    {
        var rootPath = _options.ResolveRootPath(_environment);
        Directory.CreateDirectory(rootPath);
        return rootPath;
    }

    private static async Task<DetectedImageType?> DetectImageTypeAsync(
        IFormFile file,
        CancellationToken cancellationToken
    )
    {
        var header = new byte[64];

        await using var stream = file.OpenReadStream();

        var bytesRead = await stream.ReadAsync(
            header.AsMemory(0, header.Length),
            cancellationToken
        );

        if (bytesRead >= 3 &&
            header[0] == 0xFF &&
            header[1] == 0xD8 &&
            header[2] == 0xFF)
        {
            return new DetectedImageType(
                ".jpg",
                "image/jpeg"
            );
        }

        if (bytesRead >= 8 &&
            header[0] == 0x89 &&
            header[1] == 0x50 &&
            header[2] == 0x4E &&
            header[3] == 0x47 &&
            header[4] == 0x0D &&
            header[5] == 0x0A &&
            header[6] == 0x1A &&
            header[7] == 0x0A)
        {
            return new DetectedImageType(
                ".png",
                "image/png"
            );
        }

        if (bytesRead >= 12 &&
            header[0] == 0x52 &&
            header[1] == 0x49 &&
            header[2] == 0x46 &&
            header[3] == 0x46 &&
            header[8] == 0x57 &&
            header[9] == 0x45 &&
            header[10] == 0x42 &&
            header[11] == 0x50)
        {
            return new DetectedImageType(
                ".webp",
                "image/webp"
            );
        }

        if (bytesRead >= 12 &&
            header[4] == 0x66 &&
            header[5] == 0x74 &&
            header[6] == 0x79 &&
            header[7] == 0x70)
        {
            for (var offset = 8; offset + 3 < bytesRead; offset += 4)
            {
                var isAvifBrand =
                    header[offset] == 0x61 &&
                    header[offset + 1] == 0x76 &&
                    header[offset + 2] == 0x69 &&
                    header[offset + 3] is 0x66 or 0x73;

                if (isAvifBrand)
                {
                    return new DetectedImageType(
                        ".avif",
                        "image/avif"
                    );
                }
            }
        }

        return null;
    }

    private sealed record DetectedImageType(
        string Extension,
        string ContentType
    );
}
