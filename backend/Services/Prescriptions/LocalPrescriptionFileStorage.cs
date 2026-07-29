using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace ECommerce.Services.Prescriptions;

public sealed class LocalPrescriptionFileStorage(IWebHostEnvironment environment)
    : IPrescriptionFileStorage
{
    private const long MaximumFileSize = 8 * 1024 * 1024;

    public async Task<StoredPrescriptionFile> SaveAsync(
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        if (file.Length <= 0)
            throw new InvalidOperationException("The prescription file is empty.");
        if (file.Length > MaximumFileSize)
            throw new InvalidOperationException("The prescription file must not exceed 8 MB.");

        var detected = await DetectTypeAsync(file, cancellationToken)
            ?? throw new InvalidOperationException(
                "Only valid JPG, PNG, WEBP, or PDF prescription files are supported.");

        var root = GetStorageRoot();
        var relativeDirectory = Path.Combine(
            DateTime.UtcNow.Year.ToString(),
            DateTime.UtcNow.Month.ToString("00"));
        var directory = Path.Combine(root, relativeDirectory);
        Directory.CreateDirectory(directory);

        var fileName = $"{Guid.NewGuid():N}{detected.Extension}";
        var absolutePath = Path.Combine(directory, fileName);

        try
        {
            await using var output = new FileStream(
                absolutePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                81920,
                useAsync: true);
            await file.CopyToAsync(output, cancellationToken);
        }
        catch
        {
            if (File.Exists(absolutePath)) File.Delete(absolutePath);
            throw;
        }

        var relativePath = Path.Combine(relativeDirectory, fileName).Replace("\\", "/");
        return new StoredPrescriptionFile(
            relativePath,
            Path.GetFileName(file.FileName),
            detected.ContentType,
            file.Length);
    }

    public Task DeleteAsync(
        string relativePath,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var absolutePath = ResolveSafePath(relativePath);
        if (File.Exists(absolutePath)) File.Delete(absolutePath);
        return Task.CompletedTask;
    }

    public PrescriptionFileDownload OpenRead(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            throw new FileNotFoundException("The prescription attachment is unavailable.");

        var absolutePath = ResolveSafePath(relativePath);
        if (!File.Exists(absolutePath))
            throw new FileNotFoundException("The prescription attachment is unavailable.");

        var extension = Path.GetExtension(absolutePath).ToLowerInvariant();
        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };

        return new PrescriptionFileDownload(
            new FileStream(absolutePath, FileMode.Open, FileAccess.Read, FileShare.Read),
            contentType,
            Path.GetFileName(absolutePath));
    }

    private string ResolveSafePath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            throw new FileNotFoundException("The prescription attachment is unavailable.");

        var root = Path.GetFullPath(GetStorageRoot());
        var absolutePath = Path.GetFullPath(Path.Combine(
            root,
            relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var normalizedRoot = root.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

        if (!absolutePath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
            throw new FileNotFoundException("The prescription attachment is unavailable.");

        return absolutePath;
    }

    private string GetStorageRoot()
    {
        var root = Path.Combine(environment.ContentRootPath, "App_Data", "prescriptions");
        Directory.CreateDirectory(root);
        return root;
    }

    private static async Task<DetectedType?> DetectTypeAsync(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var header = new byte[32];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);

        if (read >= 4 && header[0] == 0x25 && header[1] == 0x50 &&
            header[2] == 0x44 && header[3] == 0x46)
            return new DetectedType(".pdf", "application/pdf");

        if (read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return new DetectedType(".jpg", "image/jpeg");

        if (read >= 8 && header[0] == 0x89 && header[1] == 0x50 &&
            header[2] == 0x4E && header[3] == 0x47 && header[4] == 0x0D &&
            header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            return new DetectedType(".png", "image/png");

        if (read >= 12 && header[0] == 0x52 && header[1] == 0x49 &&
            header[2] == 0x46 && header[3] == 0x46 && header[8] == 0x57 &&
            header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50)
            return new DetectedType(".webp", "image/webp");

        return null;
    }

    private sealed record DetectedType(string Extension, string ContentType);
}
