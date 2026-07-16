namespace ECommerce.Services.Products;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

public sealed class LocalProductImageStorage : IProductImageStorage
{
    private const long MaximumImageSize = 5 * 1024 * 1024;

    private readonly IWebHostEnvironment _environment;

    public LocalProductImageStorage(
        IWebHostEnvironment environment
    )
    {
        _environment = environment;
    }

    public async Task<StoredProductImage> SaveAsync(
        IFormFile file,
        CancellationToken cancellationToken = default
    )
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException(
                "The uploaded image is empty."
            );
        }

        if (file.Length > MaximumImageSize)
        {
            throw new InvalidOperationException(
                "The image must not exceed 5 MB."
            );
        }

        var imageType = await DetectImageTypeAsync(
            file,
            cancellationToken
        );

        if (imageType is null)
        {
            throw new InvalidOperationException(
                "Only valid JPG, PNG and WEBP images are supported."
            );
        }

        var webRootPath = GetWebRootPath();

        var year = DateTime.UtcNow.Year.ToString();
        var month = DateTime.UtcNow.Month.ToString("00");

        var relativeDirectory = Path.Combine(
            "uploads",
            "products",
            year,
            month
        );

        var absoluteDirectory = Path.Combine(
            webRootPath,
            relativeDirectory
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

        var relativePath = Path.Combine(
                relativeDirectory,
                fileName
            )
            .Replace("\\", "/");

        return new StoredProductImage(
            RelativePath: relativePath,
            PublicUrl: $"/{relativePath}",
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

        var rootPath = Path.GetFullPath(
            GetWebRootPath()
        );

        var normalizedRoot = rootPath.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar
        ) + Path.DirectorySeparatorChar;

        var normalizedRelativePath = relativePath.Replace(
            '/',
            Path.DirectorySeparatorChar
        );

        var absolutePath = Path.GetFullPath(
            Path.Combine(
                rootPath,
                normalizedRelativePath
            )
        );

        if (!absolutePath.StartsWith(
                normalizedRoot,
                StringComparison.OrdinalIgnoreCase
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

    private string GetWebRootPath()
    {
        if (!string.IsNullOrWhiteSpace(
                _environment.WebRootPath
            ))
        {
            return _environment.WebRootPath;
        }

        var webRootPath = Path.Combine(
            _environment.ContentRootPath,
            "wwwroot"
        );

        Directory.CreateDirectory(webRootPath);

        return webRootPath;
    }

    private static async Task<DetectedImageType?> DetectImageTypeAsync(
        IFormFile file,
        CancellationToken cancellationToken
    )
    {
        var header = new byte[12];

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

        return null;
    }

    private sealed record DetectedImageType(
        string Extension,
        string ContentType
    );
}
