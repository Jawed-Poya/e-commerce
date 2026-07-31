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
using ECommerce.Services.Company;
using ECommerce.Services.Auditing;
using ECommerce.Shared;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Channels;
using ECommerce.Entities.Users;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

public class ApplicationDbContext
    : IdentityDbContext<User, Role, string>
{
    private readonly ICompanyContext _companyContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ActivityLogQueue _activityLogQueue;
    private readonly ILogger<ApplicationDbContext> _logger;

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

    private static readonly HashSet<string> MutationAuditTypes = new(StringComparer.Ordinal)
    {
        nameof(Product),
        nameof(ProductImage),
        nameof(ProductPrice),
        nameof(ProductUnitConversion),
        nameof(ProductInventory),
        nameof(ProductVariant),
        nameof(InventoryTransaction),
        nameof(InventoryLot),
        nameof(Warehouse),
        nameof(Customer),
        nameof(CustomerAddress),
        nameof(Order),
        nameof(OrderItem),
        nameof(Payment),
        nameof(OrderStatusHistory),
        nameof(GeneralType),
        nameof(Supplier),
        nameof(Purchase),
        nameof(PurchaseItem),
        nameof(PurchasePayment),
        nameof(InventorySale),
        nameof(InventorySaleItem),
        nameof(InventorySalePayment),
        nameof(Staff),
        nameof(StaffSalaryPayment),
        nameof(StaffSalaryInstallment),
        nameof(ExpenseCategory),
        nameof(Expense),
        nameof(ProductReview),
        nameof(StorefrontContent)
    };

    private static readonly HashSet<string> IgnoredAuditProperties = new(StringComparer.OrdinalIgnoreCase)
    {
        nameof(API.Entities.Common.BaseEntity.CreatedAt),
        nameof(API.Entities.Common.BaseEntity.UpdatedAt),
        nameof(API.Entities.Common.BaseEntity.DeletedAt),
        nameof(API.Entities.Common.BaseEntity.TenantId),
        nameof(API.Entities.Common.BaseEntity.BranchId),
        "RowVersion",
        "ConcurrencyStamp",
        "SecurityStamp",
        "PasswordHash",
        "RefreshToken",
        "Token"
    };

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICompanyContext companyContext,
        IHttpContextAccessor httpContextAccessor,
        ActivityLogQueue activityLogQueue,
        ILogger<ApplicationDbContext> logger)
        : base(options)
    {
        _companyContext = companyContext;
        _httpContextAccessor = httpContextAccessor;
        _activityLogQueue = activityLogQueue;
        _logger = logger;
    }

    public long CurrentCompanyId => _companyContext.CompanyId;
    public bool BypassCompanyFilter => false;

    #region Catalog

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    public DbSet<ProductPrice> ProductPrices => Set<ProductPrice>();
    public DbSet<ProductUnitConversion> ProductUnitConversions => Set<ProductUnitConversion>();

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
    public DbSet<CustomerVisitLog> CustomerVisitLogs => Set<CustomerVisitLog>();

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
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<SubscriptionPlanPermission> SubscriptionPlanPermissions => Set<SubscriptionPlanPermission>();
    public DbSet<PlatformSetting> PlatformSettings => Set<PlatformSetting>();
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
            entity.HasIndex(item => item.StorefrontKey).IsUnique();
            entity.HasIndex(item => item.CustomDomain).IsUnique().HasFilter("[CustomDomain] IS NOT NULL");
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
            entity.HasOne(item => item.SubscriptionPlan).WithMany(item => item.Subscriptions)
                .HasForeignKey(item => item.SubscriptionPlanId).OnDelete(DeleteBehavior.SetNull);
        });
        builder.Entity<SubscriptionPlan>(entity =>
        {
            entity.Property(item => item.MonthlyPrice).HasPrecision(18, 2);
            entity.Property(item => item.YearlyPrice).HasPrecision(18, 2);
            entity.HasIndex(item => item.Code).IsUnique();
        });
        builder.Entity<SubscriptionPlanPermission>(entity =>
        {
            entity.HasIndex(item => new { item.SubscriptionPlanId, item.Permission }).IsUnique();
            entity.HasOne(item => item.SubscriptionPlan).WithMany(item => item.Permissions)
                .HasForeignKey(item => item.SubscriptionPlanId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<PlatformSetting>(entity =>
        {
            entity.Property(item => item.Id).ValueGeneratedNever();
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
        builder.Entity<ProductUnitConversion>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Unit.IsDeleted);
        builder.Entity<InventoryTransaction>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<ProductReview>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<ProductVariant>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<InventoryLot>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Warehouse.IsDeleted);
        builder.Entity<Warehouse>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<CustomerAddress>().HasQueryFilter(x => !x.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<OrderItem>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<Payment>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
        builder.Entity<OrderStatusHistory>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
        builder.Entity<ActivityLog>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<CustomerVisitLog>().HasQueryFilter(x => !x.IsDeleted);

        ApplyCompanyQueryFilters(builder);
    }

    public override int SaveChanges()
    {
        ApplyAuditFields();
        var audits = CaptureMutationAudits();
        var result = base.SaveChanges();
        QueueMutationAudits(audits, useBackPressure: true).GetAwaiter().GetResult();
        return result;
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        var audits = CaptureMutationAudits();
        var result = await base.SaveChangesAsync(cancellationToken);
        await QueueMutationAudits(audits, useBackPressure: true);
        return result;
    }

    private IReadOnlyList<PendingMutationAudit> CaptureMutationAudits()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext?.User.Identity?.IsAuthenticated != true)
            return [];

        return ChangeTracker.Entries<API.Entities.Common.BaseEntity>()
            .Where(entry => MutationAuditTypes.Contains(entry.Entity.GetType().Name))
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(entry => CreatePendingMutationAudit(entry, httpContext))
            .Where(item => item is not null)
            .Cast<PendingMutationAudit>()
            .ToArray();
    }

    private static PendingMutationAudit? CreatePendingMutationAudit(
        EntityEntry<API.Entities.Common.BaseEntity> entry,
        HttpContext httpContext)
    {
        var deleted = entry.State == EntityState.Deleted ||
            (entry.State == EntityState.Modified &&
             entry.Entity.IsDeleted &&
             entry.Property(nameof(API.Entities.Common.BaseEntity.IsDeleted)).IsModified);
        var action = deleted
            ? ActivityAction.Delete
            : entry.State == EntityState.Added
                ? ActivityAction.Create
                : ActivityAction.Update;

        var changes = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in entry.Properties)
        {
            var name = property.Metadata.Name;
            if (IgnoredAuditProperties.Contains(name) || property.Metadata.IsPrimaryKey())
                continue;
            if (entry.State == EntityState.Modified && !property.IsModified)
                continue;

            var original = NormalizeAuditValue(property.OriginalValue);
            var current = NormalizeAuditValue(property.CurrentValue);
            if (entry.State == EntityState.Modified && Equals(original, current))
                continue;

            changes[name] = entry.State == EntityState.Added
                ? current
                : new { oldValue = original, newValue = current };
        }

        if (action == ActivityAction.Update && changes.Count == 0)
            return null;

        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        var device = ClientDeviceParser.Parse(userAgent);
        var entityName = entry.Entity.GetType().Name;
        return new PendingMutationAudit(
            entry,
            new ActivityLog
            {
                TenantId = entry.Entity.TenantId,
                BranchId = entry.Entity.BranchId,
                UserId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? httpContext.User.FindFirstValue("sub"),
                UserName = httpContext.User.FindFirstValue(ClaimTypes.Name)
                    ?? httpContext.User.Identity?.Name,
                CustomerId = long.TryParse(httpContext.User.FindFirstValue(AuthClaims.CustomerId), out var customerId)
                    ? customerId
                    : null,
                Action = action,
                EntityName = entityName,
                Description = $"{action} {entityName}.",
                Changes = changes.Count == 0 ? null : JsonSerializer.Serialize(changes),
                HttpMethod = httpContext.Request.Method,
                Path = httpContext.Request.Path + httpContext.Request.QueryString,
                StatusCode = StatusCodes.Status200OK,
                RequestId = httpContext.TraceIdentifier,
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = LimitAuditValue(userAgent, 1000),
                DeviceType = device.DeviceType,
                Browser = device.Browser,
                OperatingSystem = device.OperatingSystem,
                CreatedAt = DateTime.UtcNow
            });
    }

    private async ValueTask QueueMutationAudits(
        IReadOnlyCollection<PendingMutationAudit> pending,
        bool useBackPressure)
    {
        foreach (var item in pending)
        {
            item.Log.EntityId = item.Entry.Entity.Id > 0 ? item.Entry.Entity.Id : null;
            item.Log.TenantId = item.Entry.Entity.TenantId > 0
                ? item.Entry.Entity.TenantId
                : _companyContext.CompanyId;
            item.Log.BranchId ??= item.Entry.Entity.BranchId ?? _companyContext.BranchId;

            try
            {
                if (useBackPressure)
                    await _activityLogQueue.EnqueueAsync(item.Log, CancellationToken.None);
                else if (!_activityLogQueue.TryEnqueue(item.Log))
                    await _activityLogQueue.EnqueueAsync(item.Log, CancellationToken.None);
            }
            catch (ChannelClosedException)
            {
                // The business transaction has already committed. A host
                // shutdown must never turn that successful write into a 500.
                _logger.LogCritical(
                    "Audit queue closed before {EntityName} #{EntityId} could be enqueued.",
                    item.Log.EntityName,
                    item.Log.EntityId);
            }
        }
    }

    private static object? NormalizeAuditValue(object? value) => value switch
    {
        null => null,
        byte[] bytes => $"[{bytes.Length} bytes]",
        string text when text.Length > 500 => text[..500] + "…",
        DateTime date => date.ToUniversalTime(),
        _ => value
    };

    private static string? LimitAuditValue(string? value, int maximum) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value.Length <= maximum ? value : value[..maximum];

    private sealed record PendingMutationAudit(
        EntityEntry<API.Entities.Common.BaseEntity> Entry,
        ActivityLog Log);

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
                if (entry.Entity.TenantId <= 0) entry.Entity.TenantId = _companyContext.CompanyId;
                entry.Entity.BranchId ??= _companyContext.BranchId;
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
            TenantId = entity.TenantId <= 0 ? _companyContext.CompanyId : entity.TenantId,
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

    private void ApplyCompanyQueryFilters(ModelBuilder builder)
    {
        foreach (var entityType in builder.Model.GetEntityTypes()
                     .Where(item => typeof(API.Entities.Common.BaseEntity).IsAssignableFrom(item.ClrType)))
        {
            var parameter = Expression.Parameter(entityType.ClrType, "entity");
            var tenantProperty = Expression.Property(parameter, nameof(API.Entities.Common.BaseEntity.TenantId));
            var currentTenant = Expression.Property(Expression.Constant(this), nameof(CurrentCompanyId));
            var bypass = Expression.Property(Expression.Constant(this), nameof(BypassCompanyFilter));
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
