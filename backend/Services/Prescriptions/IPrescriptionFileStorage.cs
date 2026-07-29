using Microsoft.AspNetCore.Http;

namespace ECommerce.Services.Prescriptions;

public interface IPrescriptionFileStorage
{
    Task<StoredPrescriptionFile> SaveAsync(
        IFormFile file,
        CancellationToken cancellationToken = default);

    PrescriptionFileDownload OpenRead(string relativePath);

    Task DeleteAsync(
        string relativePath,
        CancellationToken cancellationToken = default);
}

public sealed record StoredPrescriptionFile(
    string RelativePath,
    string OriginalFileName,
    string ContentType,
    long Size);

public sealed record PrescriptionFileDownload(
    Stream Stream,
    string ContentType,
    string FileName);
