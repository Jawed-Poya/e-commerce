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
using ECommerce.Entities.Tenancy;
using ECommerce.Services.Tenancy;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using ECommerce.Entities.Users;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public class ApplicationDbContext
    : IdentityDbContext<User, Role, string>
{
    private readonly ITenantContext _tenantContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    private static readonly HashSet<string> TrashRootTypes = new(StringComparer.Ordinal)
    {
        nameof(Product),
        nameof(Customer),
        nameof(Order),
        nameof(GeneralType),
        nameof(Supplier),
        nameof(Purchase),
        nameof(InventorySale),
        nameof(Staff),
        nameof(StaffSalaryPayment),
        nameof(Expense),
        nameof(Warehouse),
        nameof(ProductReview),
        nameof(Notification),
        nameof(StorefrontContent)
    };

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantContext tenantContext,
        IHttpContextAccessor httpContextAccessor)
        : base(options)
    {
        _tenantContext = tenantContext;
        _httpContextAccessor = httpContextAccessor;
    }

    public long CurrentTenantId => _tenantContext.TenantId;
    public bool BypassTenantFilter => false;

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

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<TenantSubscription> TenantSubscriptions => Set<TenantSubscription>();
    public DbSet<TenantPermissionGrant> TenantPermissionGrants => Set<TenantPermissionGrant>();
    public DbSet<TenantSetting> TenantSettings => Set<TenantSetting>();
    public DbSet<TrashRecord> TrashRecords => Set<TrashRecord>();

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
                x.TenantId,
                x.Group,
                x.Name
            })
            .IsUnique();


        builder.Entity<Tenant>(entity =>
        {
            entity.HasIndex(item => item.Slug).IsUnique();
            entity.HasOne(item => item.Setting).WithOne(item => item.Tenant)
                .HasForeignKey<TenantSetting>(item => item.TenantId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<Branch>(entity =>
        {
            entity.HasIndex(item => new { item.TenantId, item.Code }).IsUnique();
            entity.HasOne(item => item.Tenant).WithMany(item => item.Branches)
                .HasForeignKey(item => item.TenantId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<TenantSubscription>(entity =>
        {
            entity.Property(item => item.MonthlyPrice).HasPrecision(18, 2);
            entity.HasIndex(item => new { item.TenantId, item.Status });
            entity.HasOne(item => item.Tenant).WithMany(item => item.Subscriptions)
                .HasForeignKey(item => item.TenantId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<TenantPermissionGrant>(entity =>
        {
            entity.HasIndex(item => new { item.TenantId, item.Permission }).IsUnique();
            entity.HasOne(item => item.Tenant).WithMany(item => item.PermissionGrants)
                .HasForeignKey(item => item.TenantId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<TenantSetting>(entity =>
        {
            entity.HasIndex(item => item.TenantId).IsUnique();
        });
        builder.Entity<TrashRecord>(entity =>
        {
            entity.HasIndex(item => new { item.TenantId, item.EntityType, item.EntityId, item.PurgedAt });
        });
        builder.Entity<User>(entity =>
        {
            entity.HasIndex(item => new { item.TenantId, item.NormalizedEmail })
                .IsUnique()
                .HasFilter("[NormalizedEmail] IS NOT NULL");
            entity.HasIndex(item => item.BranchId);
        });
        builder.Entity<Role>(entity =>
        {
            entity.HasIndex(item => item.TenantId);
        });

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

        ApplyTenantQueryFilters(builder);
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
        var trash = new List<TrashRecord>();

        foreach (var entry in ChangeTracker.Entries<API.Entities.Common.BaseEntity>().ToArray())
        {
            if (entry.Entity is TrashRecord)
                continue;

            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default) entry.Entity.CreatedAt = now;
                if (entry.Entity.TenantId <= 0) entry.Entity.TenantId = _tenantContext.TenantId;
                entry.Entity.BranchId ??= _tenantContext.BranchId;
            }

            var isDeleteTransition = entry.State == EntityState.Deleted ||
                (entry.State == EntityState.Modified &&
                 entry.Property(nameof(API.Entities.Common.BaseEntity.IsDeleted)).IsModified &&
                 !entry.Property(nameof(API.Entities.Common.BaseEntity.IsDeleted)).OriginalValue.Equals(true) &&
                 entry.Entity.IsDeleted);

            if (isDeleteTransition)
            {
                entry.State = EntityState.Modified;
                entry.Entity.IsDeleted = true;
                entry.Entity.DeletedAt ??= now;
                entry.Entity.UpdatedAt = now;
                if (TrashRootTypes.Contains(entry.Entity.GetType().Name))
                    trash.Add(CreateTrashRecord(entry.Entity, now));
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }

        if (trash.Count > 0) TrashRecords.AddRange(trash);
    }

    private TrashRecord CreateTrashRecord(API.Entities.Common.BaseEntity entity, DateTime now)
    {
        var type = entity.GetType().Name;
        var displayProperty = entity.GetType().GetProperty("Name")
            ?? entity.GetType().GetProperty("FullName")
            ?? entity.GetType().GetProperty("OrderNumber")
            ?? entity.GetType().GetProperty("PurchaseNumber")
            ?? entity.GetType().GetProperty("SaleNumber")
            ?? entity.GetType().GetProperty("EmployeeNumber")
            ?? entity.GetType().GetProperty("Title")
            ?? entity.GetType().GetProperty("Description");
        var displayName = displayProperty?.GetValue(entity)?.ToString();
        var principal = _httpContextAccessor.HttpContext?.User;
        var deletedByUserId = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var deletedByName = principal?.FindFirstValue(ClaimTypes.Name)
            ?? principal?.Identity?.Name;
        return new TrashRecord
        {
            TenantId = entity.TenantId <= 0 ? _tenantContext.TenantId : entity.TenantId,
            BranchId = entity.BranchId,
            EntityType = type,
            EntityId = entity.Id.ToString(),
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? $"{type} #{entity.Id}" : displayName!,
            DeletedByUserId = deletedByUserId,
            DeletedByName = deletedByName,
            SnapshotJson = JsonSerializer.Serialize(entity, entity.GetType(), new JsonSerializerOptions
            {
                ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
            }),
            CreatedAt = now
        };
    }

    private void ApplyTenantQueryFilters(ModelBuilder builder)
    {
        foreach (var entityType in builder.Model.GetEntityTypes()
                     .Where(item => typeof(API.Entities.Common.BaseEntity).IsAssignableFrom(item.ClrType)))
        {
            var parameter = Expression.Parameter(entityType.ClrType, "entity");
            var tenantProperty = Expression.Property(parameter, nameof(API.Entities.Common.BaseEntity.TenantId));
            var currentTenant = Expression.Property(Expression.Constant(this), nameof(CurrentTenantId));
            var bypass = Expression.Property(Expression.Constant(this), nameof(BypassTenantFilter));
            Expression tenantBody = Expression.OrElse(bypass, Expression.Equal(tenantProperty, currentTenant));

            var existing = entityType.GetQueryFilter();
            if (existing is not null)
            {
                var existingBody = new ReplaceExpressionVisitor(existing.Parameters[0], parameter)
                    .Visit(existing.Body)!;
                tenantBody = Expression.AndAlso(existingBody, tenantBody);
            }

            entityType.SetQueryFilter(Expression.Lambda(tenantBody, parameter));
        }
    }

    private sealed class ReplaceExpressionVisitor(Expression oldValue, Expression newValue) : ExpressionVisitor
    {
        public override Expression? Visit(Expression? node) =>
            node == oldValue ? newValue : base.Visit(node);
    }
}
