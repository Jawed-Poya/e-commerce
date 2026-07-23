using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using ECommerce.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ECommerce.Data.Configurations;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(100);
        b.Property(x => x.Phone).HasMaxLength(30).IsRequired();
        b.Property(x => x.Email).HasMaxLength(256);
        b.HasIndex(x => new { x.TenantId, x.Phone }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Email }).IsUnique().HasFilter("[Email] IS NOT NULL");
        b.HasOne(x => x.CustomerType).WithMany().HasForeignKey(x => x.CustomerTypeId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProductPriceConfiguration : IEntityTypeConfiguration<ProductPrice>
{
    public void Configure(EntityTypeBuilder<ProductPrice> b)
    {
        b.Property(x => x.RegularPrice).HasPrecision(18, 2);
        b.Property(x => x.SalePrice).HasPrecision(18, 2);
        b.ToTable(t => {
            t.HasCheckConstraint("CK_ProductPrice_RegularPrice", "[RegularPrice] >= 0");
            t.HasCheckConstraint("CK_ProductPrice_SalePrice", "[SalePrice] IS NULL OR ([SalePrice] >= 0 AND [SalePrice] <= [RegularPrice])");
            t.HasCheckConstraint("CK_ProductPrice_DateRange", "[EndDate] IS NULL OR [StartDate] IS NULL OR [EndDate] >= [StartDate]");
        });
        b.HasIndex(x => new { x.ProductId, x.CustomerTypeId, x.StartDate, x.EndDate });
    }
}

public sealed class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> b)
    {
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.QuantityBefore).HasPrecision(18, 3);
        b.Property(x => x.QuantityAfter).HasPrecision(18, 3);
        b.Property(x => x.ReservedBefore).HasPrecision(18, 3);
        b.Property(x => x.ReservedAfter).HasPrecision(18, 3);
        b.Property(x => x.ReferenceType).HasMaxLength(50);
        b.Property(x => x.IdempotencyKey).HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique().HasFilter("[IdempotencyKey] IS NOT NULL");
        b.HasIndex(x => new { x.ReferenceType, x.ReferenceId });
    }
}

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.OrderNumber }).IsUnique();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.Subtotal).HasPrecision(18, 2);
        b.Property(x => x.DiscountTotal).HasPrecision(18, 2);
        b.Property(x => x.TaxTotal).HasPrecision(18, 2);
        b.Property(x => x.ShippingTotal).HasPrecision(18, 2);
        b.ToTable(t => t.HasCheckConstraint("CK_Order_Totals", "[Subtotal] >= 0 AND [DiscountTotal] >= 0 AND [TaxTotal] >= 0 AND [ShippingTotal] >= 0 AND [Total] >= 0"));
    }
}

public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
        b.Property(x => x.ProductBarcode).HasMaxLength(100);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Property(x => x.Discount).HasPrecision(18, 2);
        b.Property(x => x.Tax).HasPrecision(18, 2);
        b.ToTable(t => t.HasCheckConstraint("CK_OrderItem_Values", "[Quantity] > 0 AND [UnitPrice] >= 0 AND [Discount] >= 0 AND [Tax] >= 0"));
    }
}

public sealed class ProductReviewConfiguration : IEntityTypeConfiguration<ProductReview>
{
    public void Configure(EntityTypeBuilder<ProductReview> b)
    {
        b.HasIndex(x => new { x.ProductId, x.CustomerId }).IsUnique();
        b.ToTable(t => t.HasCheckConstraint("CK_ProductReview_Rating", "[Rating] BETWEEN 1 AND 5"));
    }
}

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.Property(x => x.Provider).HasMaxLength(50).IsRequired();
        b.Property(x => x.ExternalReference).HasMaxLength(150);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.Provider, x.ExternalReference }).IsUnique().HasFilter("[ExternalReference] IS NOT NULL");
    }
}

public sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> b)
    {
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Sku).HasMaxLength(100).IsRequired();
        b.Property(x => x.Barcode).HasMaxLength(100);
        b.Property(x => x.PriceAdjustment).HasPrecision(18, 2);
        b.HasIndex(x => new { x.TenantId, x.Sku }).IsUnique();
        b.HasIndex(x => new { x.TenantId, x.Barcode }).IsUnique().HasFilter("[Barcode] IS NOT NULL");
        b.HasOne(x => x.Product).WithMany(x => x.Variants).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse>
{
    public void Configure(EntityTypeBuilder<Warehouse> b)
    {
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Code).HasMaxLength(30).IsRequired();
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
    }
}

public sealed class InventoryLotConfiguration : IEntityTypeConfiguration<InventoryLot>
{
    public void Configure(EntityTypeBuilder<InventoryLot> b)
    {
        b.Property(x => x.LotNumber).HasMaxLength(100);
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.ReservedQuantity).HasPrecision(18, 3);
        b.Property(x => x.UnitCost).HasPrecision(18, 2);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => new { x.ProductId, x.ProductVariantId, x.WarehouseId, x.LotNumber });
        b.ToTable(t => {
            t.HasCheckConstraint("CK_InventoryLot_Quantity", "[Quantity] >= 0 AND [ReservedQuantity] >= 0 AND [ReservedQuantity] <= [Quantity]");
            t.HasCheckConstraint("CK_InventoryLot_Expiry", "[ExpiresAt] IS NULL OR [ManufacturedAt] IS NULL OR [ExpiresAt] >= [ManufacturedAt]");
        });
    }
}
