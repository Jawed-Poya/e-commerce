namespace ECommerce.Entities.Products.Requests;


using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

public sealed class CreateBulkProductsRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "At least one product is required.")]
    [MaxLength(50, ErrorMessage = "A maximum of 50 products is allowed.")]
    public List<CreateBulkProductItemRequest> Products { get; set; } = [];
}

public sealed class CreateBulkProductItemRequest
{
    [Required]
    public IFormFile? Image { get; set; }

    public List<IFormFile> GalleryImages { get; set; } = [];

    [Required]
    [StringLength(
        200,
        MinimumLength = 2,
        ErrorMessage = "Product name must contain between 2 and 200 characters."
    )]
    public string Name { get; set; } = null!;

    [StringLength(100)]
    public string? Barcode { get; set; }

    [StringLength(500)]
    public string? ShortDescription { get; set; }

    [StringLength(5000)]
    public string? Description { get; set; }

    [Range(0, int.MaxValue)]
    public int? MinimumValue { get; set; }

    [Range(0, int.MaxValue)]
    public int? MaximumValue { get; set; }

    [Range(1, long.MaxValue, ErrorMessage = "Category is required.")]
    public long CategoryId { get; set; }

    public long? BrandId { get; set; }

    public long? UnitId { get; set; }

    public bool IsFeatured { get; set; }

    public bool IsActive { get; set; } = true;

    [StringLength(250)]
    public string? Slug { get; set; }
}
