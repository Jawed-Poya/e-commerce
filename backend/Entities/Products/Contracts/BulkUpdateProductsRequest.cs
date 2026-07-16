namespace ECommerce.Entities.Products.Contracts;

using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

public sealed class BulkUpdateProductsRequest
{
    [Required, MinLength(1), MaxLength(50)]
    public List<BulkUpdateProductItemRequest> Products { get; set; } = [];
}

public sealed class BulkUpdateProductItemRequest
{
    [Range(1, long.MaxValue)]
    public long Id { get; set; }

    [Required, StringLength(200, MinimumLength = 2)]
    public string Name { get; set; } = null!;

    [StringLength(100)]
    public string? Barcode { get; set; }

    public IFormFile? Image { get; set; }

    [StringLength(500)]
    public string? ShortDescription { get; set; }

    [StringLength(5000)]
    public string? Description { get; set; }

    [StringLength(250)]
    public string? Slug { get; set; }

    [Range(1, long.MaxValue)]
    public long CategoryId { get; set; }

    public long? BrandId { get; set; }
    public long? UnitId { get; set; }
    public int? MinimumValue { get; set; }
    public int? MaximumValue { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; }
}

public sealed record BulkUpdateProductsResponse(int UpdatedCount);
