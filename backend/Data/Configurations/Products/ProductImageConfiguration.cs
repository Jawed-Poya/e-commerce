namespace ECommerce.Data.Configurations.Products;

using API.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class ProductImageConfiguration
    : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ImagePath)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.FileName)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.OriginalFileName)
            .HasMaxLength(300);

        builder.Property(x => x.ContentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasIndex(x => new
        {
            x.ProductId,
            x.SortOrder
        });

        builder.HasIndex(x => new
        {
            x.ProductId,
            x.IsPrimary
        }).IsUnique().HasFilter("[IsPrimary] = 1");
    }
}
