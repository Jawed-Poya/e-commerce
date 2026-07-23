namespace ECommerce.Data;

using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Entities;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
using ECommerce.Entities.Storefront;
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
    public DbSet<StorefrontContent> StorefrontContents => Set<StorefrontContent>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<PurchasePayment> PurchasePayments => Set<PurchasePayment>();
    public DbSet<InventorySale> InventorySales => Set<InventorySale>();
    public DbSet<InventorySaleItem> InventorySaleItems => Set<InventorySaleItem>();
    public DbSet<InventorySalePayment> InventorySalePayments => Set<InventorySalePayment>();
    public DbSet<Staff> StaffMembers => Set<Staff>();
    public DbSet<StaffSalaryPayment> StaffSalaryPayments => Set<StaffSalaryPayment>();
    public DbSet<StaffSalaryInstallment> StaffSalaryInstallments => Set<StaffSalaryInstallment>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();

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

        builder.Entity<StorefrontContent>(entity =>
        {
            entity.Property(item => item.HeroImageUrl).HasMaxLength(2048);
            entity.Property(item => item.PrimaryButtonUrl).HasMaxLength(500);
            entity.Property(item => item.SecondaryButtonUrl).HasMaxLength(500);
            entity.Property(item => item.FlatShippingFee).HasPrecision(18, 2);
            entity.Property(item => item.FreeShippingThreshold).HasPrecision(18, 2);
        });

        builder.Entity<Product>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Customer>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Order>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<GeneralType>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<StorefrontContent>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Supplier>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Purchase>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<PurchaseItem>().HasQueryFilter(x => !x.IsDeleted && !x.Purchase.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<PurchasePayment>().HasQueryFilter(x => !x.IsDeleted && !x.Purchase.IsDeleted);
        builder.Entity<InventorySale>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<InventorySaleItem>().HasQueryFilter(x => !x.IsDeleted && !x.InventorySale.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<InventorySalePayment>().HasQueryFilter(x => !x.IsDeleted && !x.InventorySale.IsDeleted);
        builder.Entity<Staff>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<StaffSalaryPayment>().HasQueryFilter(x => !x.IsDeleted && !x.Staff.IsDeleted);
        builder.Entity<StaffSalaryInstallment>().HasQueryFilter(x => !x.IsDeleted && !x.StaffSalaryPayment.IsDeleted && !x.StaffSalaryPayment.Staff.IsDeleted);
        builder.Entity<ExpenseCategory>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Expense>().HasQueryFilter(x => !x.IsDeleted && (x.Category == null || !x.Category.IsDeleted) && (x.GeneralTypeCategory == null || !x.GeneralTypeCategory.IsDeleted));
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
