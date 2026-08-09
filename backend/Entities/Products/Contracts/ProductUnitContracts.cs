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
    bool IsBaseUnit,
    bool IsDefault,
    bool IsActive,
    int SortOrder,
    decimal AvailableQuantity,
    decimal? Price,
    decimal? OldPrice);
