namespace ECommerce.Services.Products;

using Microsoft.AspNetCore.Http;

public interface IProductImageStorage
{
    Task<StoredProductImage> SaveAsync(
        IFormFile file,
        CancellationToken cancellationToken = default
    );

    Task<StoredProductImage> SaveAsync(
        IFormFile file,
        string collection,
        CancellationToken cancellationToken = default
    );

    Task DeleteAsync(
        string relativePath,
        CancellationToken cancellationToken = default
    );
}

public sealed record StoredProductImage(
    string RelativePath,
    string PublicUrl,
    string FileName,
    string ContentType,
    long Size
);
