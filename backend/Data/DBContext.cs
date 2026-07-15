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

    #endregion


    #region Sales

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    #endregion


    #region Customers

    public DbSet<Customer> Customers => Set<Customer>();

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
    }
}
