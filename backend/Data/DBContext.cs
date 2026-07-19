namespace ECommerce.Data;

using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Entities;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Products;
using ECommerce.Entities.Users;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public class ApplicationDbContext
    : IdentityDbContext<User, Role, string>
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    #region Catalog

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    public DbSet<ProductPrice> ProductPrices => Set<ProductPrice>();

    public DbSet<ProductInventory> ProductInventories => Set<ProductInventory>();

    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();

    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<InventoryLot> InventoryLots => Set<InventoryLot>();

    #endregion


    #region Sales

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();

    #endregion


    #region Customers

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();

    #endregion


    #region Common

    public DbSet<GeneralType> Types => Set<GeneralType>();

    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    public DbSet<Notification> Notifications => Set<Notification>();

    #endregion


    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);


        builder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly
        );

        builder.Entity<GeneralType>()
            .HasIndex(x => new
            {
                x.Group,
                x.Name
            })
            .IsUnique();

        builder.Entity<Product>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Customer>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Order>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<GeneralType>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<ProductImage>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<ProductInventory>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<ProductPrice>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.CustomerType.IsDeleted);
        builder.Entity<InventoryTransaction>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<ProductReview>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<ProductVariant>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<InventoryLot>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Warehouse.IsDeleted);
        builder.Entity<Warehouse>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<CustomerAddress>().HasQueryFilter(x => !x.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<OrderItem>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<Payment>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
        builder.Entity<OrderStatusHistory>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
    }

    public override int SaveChanges()
    {
        ApplyAuditFields();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyAuditFields()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<API.Entities.Common.BaseEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.CreatedAt == default)
                entry.Entity.CreatedAt = now;
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = now;
        }
    }
}
