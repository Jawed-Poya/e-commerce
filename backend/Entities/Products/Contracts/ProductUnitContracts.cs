using System.ComponentModel.DataAnnotations;

namespace ECommerce.Entities.Products.Contracts;

public sealed class ProductUnitConversionRequest
{
    public long? Id { get; set; }

    [Range(1, long.MaxValue, ErrorMessage = "Unit is required.")]
    public long UnitId { get; set; }

    [Range(typeof(decimal), "1", "999999999999.999999", ErrorMessage = "Conversion factor must be at least one base unit.")]
    public decimal ConversionFactor { get; set; } = 1;

    [StringLength(100)]
    public string? Barcode { get; set; }

    [Range(typeof(decimal), "0", "999999999999999.99")]
    public decimal? PriceOverride { get; set; }

    [Range(typeof(decimal), "0", "999999999999999.99")]
    public decimal? OldPriceOverride { get; set; }

    [Range(typeof(decimal), "0.001", "999999999999999.999", ErrorMessage = "Order quantity step must be greater than zero.")]
    public decimal OrderQuantityStep { get; set; } = 1;

    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public sealed record ProductUnitConversionResponse(
    long? Id,
    long UnitId,
    string UnitName,
    decimal ConversionFactor,
    string? Barcode,
    decimal? PriceOverride,
    decimal? OldPriceOverride,
    decimal OrderQuantityStep,
    bool IsBaseUnit,
    bool IsDefault,
    bool IsActive,
    int SortOrder,
    decimal AvailableQuantity,
    decimal? Price,
    decimal? OldPrice);
