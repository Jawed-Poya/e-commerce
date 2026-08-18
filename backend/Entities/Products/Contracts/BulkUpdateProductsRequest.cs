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

    [StringLength(100)]
    public string? Strength { get; set; }

    [StringLength(200)]
    public string? GenericName { get; set; }

    [StringLength(500)]
    public string? Formula { get; set; }

    public IFormFile? Image { get; set; }

    [MaxLength(10, ErrorMessage = "A maximum of 10 gallery images can be added at once.")]
    public List<IFormFile> GalleryImages { get; set; } = [];

    public List<long> RemovedImageIds { get; set; } = [];

    [StringLength(500)]
    public string? ShortDescription { get; set; }

    [StringLength(5000)]
    public string? Description { get; set; }

    [StringLength(250)]
    public string? Slug { get; set; }

    [Range(1, long.MaxValue)]
    public long CategoryId { get; set; }

    public long? BrandId { get; set; }
    [Required(ErrorMessage = "Base inventory unit is required.")]
    [Range(1, long.MaxValue, ErrorMessage = "Base inventory unit is required.")]
    public long? UnitId { get; set; }
    public int? MinimumValue { get; set; }
    public int? MaximumValue { get; set; }
    [Range(typeof(decimal), "0.001", "999999999999999.999", ErrorMessage = "Order quantity step must be greater than zero.")]
    public decimal OrderQuantityStep { get; set; } = 1;

    public List<decimal> QuickOrderQuantities { get; set; } = [];
    [Range(typeof(decimal), "0", "999999999999999.999", ErrorMessage = "Minimum stock quantity cannot be negative.")]
    public decimal MinimumStockQuantity { get; set; }
    public bool UsesDisplayStock { get; set; }
    public decimal? DisplayStockQuantity { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; }
    public List<ProductPriceItemRequest> Prices { get; set; } = [];
    public List<ProductUnitConversionRequest> UnitConversions { get; set; } = [];
}

public sealed record BulkUpdateProductsResponse(int UpdatedCount);
