using ECommerce.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ECommerce.Data.Configurations;

public sealed class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> b)
    {
        b.Property(x => x.EntityName).HasMaxLength(160).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000).IsRequired();
        b.Property(x => x.UserName).HasMaxLength(256);
        b.Property(x => x.HttpMethod).HasMaxLength(12);
        b.Property(x => x.Path).HasMaxLength(1000);
        b.Property(x => x.RequestId).HasMaxLength(100);
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.Property(x => x.UserAgent).HasMaxLength(1000);
        b.Property(x => x.DeviceType).HasMaxLength(40);
        b.Property(x => x.Browser).HasMaxLength(100);
        b.Property(x => x.OperatingSystem).HasMaxLength(100);
        b.HasIndex(x => x.CreatedAt);
        b.HasIndex(x => new { x.UserId, x.CreatedAt });
    }
}

public sealed class CustomerVisitLogConfiguration : IEntityTypeConfiguration<CustomerVisitLog>
{
    public void Configure(EntityTypeBuilder<CustomerVisitLog> b)
    {
        b.Property(x => x.SessionId).HasMaxLength(100).IsRequired();
        b.Property(x => x.Path).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Referrer).HasMaxLength(2000);
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.Property(x => x.UserAgent).HasMaxLength(1000);
        b.Property(x => x.DeviceType).HasMaxLength(40);
        b.Property(x => x.Browser).HasMaxLength(100);
        b.Property(x => x.OperatingSystem).HasMaxLength(100);
        b.Property(x => x.Language).HasMaxLength(20);
        b.HasIndex(x => x.CreatedAt);
        b.HasIndex(x => new { x.SessionId, x.CreatedAt });
        b.HasIndex(x => new { x.CustomerId, x.CreatedAt });
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}
