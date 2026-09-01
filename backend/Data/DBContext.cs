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
using ECommerce.Entities.Company;
using ECommerce.Services.Company;
using ECommerce.Services.Auditing;
using ECommerce.Shared;
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
    private readonly IBranchContext _branchContext;
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

    private static readonly HashSet<string> MutationAuditExcludedTypes = new(StringComparer.Ordinal)
    {
        // These tables are themselves logging/infrastructure records. Auditing
        // them would recursively create more audit rows.
        nameof(ActivityLog),
        nameof(CustomerVisitLog),
        nameof(TrashRecord),
        nameof(AccountVerificationCode),
        nameof(CustomerCart)
    };

    private static readonly HashSet<string> IgnoredAuditProperties = new(StringComparer.OrdinalIgnoreCase)
    {
        nameof(API.Entities.Common.BaseEntity.CreatedAt),
        nameof(API.Entities.Common.BaseEntity.UpdatedAt),
        nameof(API.Entities.Common.BaseEntity.DeletedAt),
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
        IBranchContext branchContext,
        IHttpContextAccessor httpContextAccessor,
        ActivityLogQueue activityLogQueue,
        ILogger<ApplicationDbContext> logger)
        : base(options)
    {
        _branchContext = branchContext;
        _httpContextAccessor = httpContextAccessor;
        _activityLogQueue = activityLogQueue;
        _logger = logger;
    }


    #region Catalog

    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    public DbSet<ProductPrice> ProductPrices => Set<ProductPrice>();
    public DbSet<ProductUnitConversion> ProductUnitConversions => Set<ProductUnitConversion>();

    public DbSet<ProductInventory> ProductInventories => Set<ProductInventory>();

    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<InventoryTransactionLot> InventoryTransactionLots => Set<InventoryTransactionLot>();

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
    public DbSet<CustomerCart> CustomerCarts => Set<CustomerCart>();

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
    public DbSet<InventorySaleReturn> InventorySaleReturns => Set<InventorySaleReturn>();
    public DbSet<InventorySaleReturnItem> InventorySaleReturnItems => Set<InventorySaleReturnItem>();
    public DbSet<Staff> StaffMembers => Set<Staff>();
    public DbSet<StaffSalaryPayment> StaffSalaryPayments => Set<StaffSalaryPayment>();
    public DbSet<StaffSalaryInstallment> StaffSalaryInstallments => Set<StaffSalaryInstallment>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<JournalVoucher> JournalVouchers => Set<JournalVoucher>();
    public DbSet<JournalVoucherLine> JournalVoucherLines => Set<JournalVoucherLine>();

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<CompanySetting> CompanySettings => Set<CompanySetting>();
    public DbSet<TrashRecord> TrashRecords => Set<TrashRecord>();
    public DbSet<AccountVerificationCode> AccountVerificationCodes => Set<AccountVerificationCode>();

    #endregion


    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);


        builder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly
        );

        builder.Entity<GeneralType>()
            .HasIndex(x => new { x.Group, x.Name })
            .IsUnique();

        builder.Entity<Branch>(entity =>
        {
            entity.HasIndex(item => item.Code).IsUnique();
        });
        builder.Entity<TrashRecord>(entity =>
        {
            entity.HasIndex(item => new { item.EntityType, item.EntityId, item.PurgedAt });
        });
        builder.Entity<User>(entity =>
        {
            entity.Property(item => item.PhoneNumber)
                .HasMaxLength(64);
            entity.HasIndex(item => item.NormalizedEmail)
                .IsUnique()
                .HasFilter("[NormalizedEmail] IS NOT NULL");
            entity.HasIndex(item => item.PhoneNumber)
                .IsUnique()
                .HasFilter("[PhoneNumber] IS NOT NULL");
            entity.HasIndex(item => item.BranchId);
        });
        builder.Entity<AccountVerificationCode>(entity =>
        {
            entity.HasOne(item => item.User)
                .WithMany()
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(item => new { item.UserId, item.Channel, item.CreatedAt });
            entity.HasIndex(item => item.ExpiresAt);
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
        builder.Entity<PurchaseItem>().HasQueryFilter(x => !x.IsDeleted && !x.Purchase.IsDeleted);
        builder.Entity<PurchasePayment>().HasQueryFilter(x => !x.IsDeleted && !x.Purchase.IsDeleted);
        builder.Entity<InventorySale>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<InventorySaleItem>().HasQueryFilter(x => !x.IsDeleted && !x.InventorySale.IsDeleted);
        builder.Entity<InventorySalePayment>().HasQueryFilter(x => !x.IsDeleted && !x.InventorySale.IsDeleted);
        builder.Entity<InventorySaleReturn>().HasQueryFilter(x => !x.IsDeleted && !x.InventorySale.IsDeleted);
        builder.Entity<InventorySaleReturnItem>().HasQueryFilter(x => !x.IsDeleted && !x.InventorySaleReturn.IsDeleted && !x.InventorySaleReturn.InventorySale.IsDeleted);
        builder.Entity<Staff>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<StaffSalaryPayment>().HasQueryFilter(x => !x.IsDeleted && !x.Staff.IsDeleted);
        builder.Entity<StaffSalaryInstallment>().HasQueryFilter(x => !x.IsDeleted && !x.StaffSalaryPayment.IsDeleted && !x.StaffSalaryPayment.Staff.IsDeleted);
        builder.Entity<ExpenseCategory>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<Expense>().HasQueryFilter(x => !x.IsDeleted && (x.Category == null || !x.Category.IsDeleted) && (x.GeneralTypeCategory == null || !x.GeneralTypeCategory.IsDeleted));
        builder.Entity<JournalVoucher>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<JournalVoucherLine>().HasQueryFilter(x => !x.IsDeleted && !x.JournalVoucher.IsDeleted);
        builder.Entity<ProductImage>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<ProductInventory>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<ProductPrice>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.CustomerType.IsDeleted);
        builder.Entity<ProductUnitConversion>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Unit.IsDeleted);
        builder.Entity<InventoryTransaction>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<InventoryTransactionLot>().HasQueryFilter(x => !x.IsDeleted && !x.InventoryTransaction.IsDeleted);
        builder.Entity<ProductReview>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<ProductVariant>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted);
        builder.Entity<InventoryLot>().HasQueryFilter(x => !x.IsDeleted && !x.Product.IsDeleted && !x.Warehouse.IsDeleted);
        builder.Entity<Warehouse>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<CustomerAddress>().HasQueryFilter(x => !x.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<CustomerCart>().HasQueryFilter(x => !x.IsDeleted && !x.Customer.IsDeleted);
        builder.Entity<OrderItem>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
        builder.Entity<Payment>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
        builder.Entity<OrderStatusHistory>().HasQueryFilter(x => !x.IsDeleted && !x.Order.IsDeleted);
        builder.Entity<ActivityLog>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<CustomerVisitLog>().HasQueryFilter(x => !x.IsDeleted);

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
            .Where(entry => !MutationAuditExcludedTypes.Contains(entry.Metadata.ClrType.Name))
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
        var deletionProperty = entry.Property(nameof(API.Entities.Common.BaseEntity.IsDeleted));
        var restored = entry.State == EntityState.Modified &&
            deletionProperty.IsModified &&
            Equals(deletionProperty.OriginalValue, true) &&
            Equals(deletionProperty.CurrentValue, false);
        var deleted = entry.State == EntityState.Deleted ||
            (entry.State == EntityState.Modified &&
             entry.Entity.IsDeleted &&
             deletionProperty.IsModified);
        var action = restored
            ? ActivityAction.Restore
            : deleted
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

        if ((action is ActivityAction.Update or ActivityAction.Restore) && changes.Count == 0)
            return null;

        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        var device = ClientDeviceParser.Parse(userAgent);
        var entityName = entry.Metadata.ClrType.Name;
        return new PendingMutationAudit(
            entry,
            new ActivityLog
            {
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
            item.Log.BranchId ??= item.Entry.Entity.BranchId ?? _branchContext.BranchId;

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
                entry.Entity.BranchId ??= _branchContext.BranchId;
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
                if (TrashRootTypes.Contains(entry.Metadata.ClrType.Name))
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

}
