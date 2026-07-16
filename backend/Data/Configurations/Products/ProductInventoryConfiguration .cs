namespace ECommerce.Data.Configurations.Products;

using API.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class ProductInventoryConfiguration
    : IEntityTypeConfiguration<ProductInventory>
{
    public void Configure(EntityTypeBuilder<ProductInventory> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Quantity)
            .HasPrecision(18, 3)
            .HasDefaultValue(0);

        builder.Property(x => x.ReservedQuantity)
            .HasPrecision(18, 3)
            .HasDefaultValue(0);

        builder.Property(x => x.MinimumQuantity)
            .HasPrecision(18, 3)
            .HasDefaultValue(0);

        builder.Property(x => x.RowVersion)
            .IsRowVersion();

        builder.ToTable(table =>
        {
            table.HasCheckConstraint("CK_ProductInventory_Quantity", "[Quantity] >= 0");
            table.HasCheckConstraint("CK_ProductInventory_ReservedQuantity", "[ReservedQuantity] >= 0 AND [ReservedQuantity] <= [Quantity]");
            table.HasCheckConstraint("CK_ProductInventory_MinimumQuantity", "[MinimumQuantity] >= 0");
        });

        builder.HasIndex(x => x.ProductId)
            .IsUnique();
    }
}
