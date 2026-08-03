using API.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ECommerce.Data.Configurations.Products;

public sealed class ProductUnitConversionConfiguration : IEntityTypeConfiguration<ProductUnitConversion>
{
    public void Configure(EntityTypeBuilder<ProductUnitConversion> builder)
    {
        builder.Property(x => x.ConversionFactor).HasPrecision(18, 6);
        builder.Property(x => x.PriceOverride).HasPrecision(18, 2);
        builder.Property(x => x.OldPriceOverride).HasPrecision(18, 2);
        builder.Property(x => x.Barcode).HasMaxLength(100);
        builder.Property(x => x.IsActive).HasDefaultValue(true);

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_ProductUnitConversion_Factor",
                "[ConversionFactor] >= 1");
            table.HasCheckConstraint(
                "CK_ProductUnitConversion_Prices",
                "[PriceOverride] IS NULL OR ([PriceOverride] >= 0 AND ([OldPriceOverride] IS NULL OR [OldPriceOverride] >= [PriceOverride]))");
            table.HasCheckConstraint(
                "CK_ProductUnitConversion_DefaultActive",
                "[IsDefault] = 0 OR [IsActive] = 1");
        });

        builder.HasIndex(x => new { x.ProductId, x.UnitId })
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");
        builder.HasIndex(x => x.Barcode)
            .IsUnique()
            .HasFilter("[Barcode] IS NOT NULL AND [IsDeleted] = 0");
        builder.HasIndex(x => x.ProductId)
            .IsUnique()
            .HasFilter("[IsDefault] = 1 AND [IsDeleted] = 0");

        builder.HasOne(x => x.Product)
            .WithMany(x => x.UnitConversions)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Unit)
            .WithMany()
            .HasForeignKey(x => x.UnitId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
