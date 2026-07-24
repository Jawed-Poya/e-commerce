using System.ComponentModel.DataAnnotations;
using API.Entities.Common;

namespace ECommerce.Entities.Tenancy;

public enum TenantPlan
{
    Free = 1,
    Premium = 2,
    Full = 3,
    Enterprise = 4
}

public enum SubscriptionStatus
{
    Trial = 1,
    Active = 2,
    PastDue = 3,
    Suspended = 4,
    Cancelled = 5,
    Expired = 6
}

public enum TenantSiteRoutingMode
{
    QueryString = 1,
    Subdomain = 2,
    CustomDomain = 3
}

public sealed class Tenant
{
    [Key]
    public long Id { get; set; }
    [MaxLength(160)] public string Name { get; set; } = null!;
    [MaxLength(100)] public string Slug { get; set; } = null!;
    [MaxLength(200)] public string? LegalName { get; set; }
    [MaxLength(40)] public string? RegistrationNumber { get; set; }
    [MaxLength(256)] public string? Email { get; set; }
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    [MaxLength(2048)] public string? LogoUrl { get; set; }
    [MaxLength(2048)] public string? FaviconUrl { get; set; }
    [MaxLength(255)] public string? CustomDomain { get; set; }
    [MaxLength(2048)] public string? StorefrontBaseUrlOverride { get; set; }
    public TenantSiteRoutingMode SiteRoutingMode { get; set; } = TenantSiteRoutingMode.QueryString;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public ICollection<Branch> Branches { get; set; } = [];
    public TenantSetting? Setting { get; set; }
    public ICollection<TenantSubscription> Subscriptions { get; set; } = [];
    public ICollection<TenantPermissionGrant> PermissionGrants { get; set; } = [];
}

public sealed class Branch
{
    [Key] public long Id { get; set; }
    public long TenantId { get; set; }
    [MaxLength(120)] public string Name { get; set; } = null!;
    [MaxLength(40)] public string Code { get; set; } = null!;
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    public bool IsMain { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public Tenant Tenant { get; set; } = null!;
}

public sealed class TenantSubscription
{
    [Key] public long Id { get; set; }
    public long TenantId { get; set; }
    public long? SubscriptionPlanId { get; set; }
    public TenantPlan Plan { get; set; } = TenantPlan.Free;
    [MaxLength(120)] public string PlanName { get; set; } = "Free";
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trial;
    public DateTime StartsAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndsAt { get; set; }
    public int MaxUsers { get; set; } = 3;
    public int MaxBranches { get; set; } = 1;
    public int MaxProducts { get; set; } = 100;
    public int MaxOrdersPerMonth { get; set; } = 500;
    public int MaxStorageMb { get; set; } = 1024;
    public decimal MonthlyPrice { get; set; }
    [MaxLength(3)] public string BillingCurrencyCode { get; set; } = "USD";
    [MaxLength(500)] public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Tenant Tenant { get; set; } = null!;
    public SubscriptionPlan? SubscriptionPlan { get; set; }
}

public sealed class SubscriptionPlan
{
    [Key] public long Id { get; set; }
    [MaxLength(80)] public string Code { get; set; } = null!;
    [MaxLength(120)] public string Name { get; set; } = null!;
    [MaxLength(600)] public string? Description { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public TenantPlan LegacyPlan { get; set; } = TenantPlan.Free;
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    [MaxLength(3)] public string CurrencyCode { get; set; } = "USD";
    public int MaxUsers { get; set; } = 3;
    public int MaxBranches { get; set; } = 1;
    public int MaxProducts { get; set; } = 100;
    public int MaxOrdersPerMonth { get; set; } = 500;
    public int MaxStorageMb { get; set; } = 1024;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public ICollection<SubscriptionPlanPermission> Permissions { get; set; } = [];
    public ICollection<TenantSubscription> Subscriptions { get; set; } = [];
}

public sealed class SubscriptionPlanPermission
{
    [Key] public long Id { get; set; }
    public long SubscriptionPlanId { get; set; }
    [MaxLength(160)] public string Permission { get; set; } = null!;
    public bool IsEnabled { get; set; } = true;
    public SubscriptionPlan SubscriptionPlan { get; set; } = null!;
}

public sealed class PlatformSetting
{
    [Key] public long Id { get; set; } = 1;
    [MaxLength(2048)] public string StorefrontBaseUrl { get; set; } = "http://localhost:5174";
    [MaxLength(2048)] public string AdminBaseUrl { get; set; } = "http://localhost:5173";
    [MaxLength(255)] public string? RootDomain { get; set; }
    public TenantSiteRoutingMode DefaultRoutingMode { get; set; } = TenantSiteRoutingMode.QueryString;
    public bool AllowCustomDomains { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class TenantPermissionGrant
{
    [Key] public long Id { get; set; }
    public long TenantId { get; set; }
    [MaxLength(160)] public string Permission { get; set; } = null!;
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Tenant Tenant { get; set; } = null!;
}

public sealed class TenantSetting
{
    [Key] public long Id { get; set; }
    public long TenantId { get; set; }
    [MaxLength(3)] public string MainCurrencyCode { get; set; } = "USD";
    [MaxLength(8)] public string CurrencySymbol { get; set; } = "$";
    [MaxLength(10)] public string CurrencyPosition { get; set; } = "before";
    public int CurrencyDecimalPlaces { get; set; } = 2;
    [MaxLength(20)] public string AdminPrimaryColor { get; set; } = "#2563eb";
    [MaxLength(20)] public string AdminSecondaryColor { get; set; } = "#0f172a";
    [MaxLength(20)] public string StorefrontPrimaryColor { get; set; } = "#2563eb";
    [MaxLength(20)] public string StorefrontSecondaryColor { get; set; } = "#0f172a";
    [MaxLength(120)] public string EnglishFontFamily { get; set; } = "Inter";
    [MaxLength(120)] public string DariFontFamily { get; set; } = "Vazirmatn";
    [MaxLength(120)] public string PashtoFontFamily { get; set; } = "Noto Sans Arabic";
    public int BaseFontSize { get; set; } = 16;
    public int TrashRetentionDays { get; set; } = 30;
    public bool AllowTenantUserClaimManagement { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Tenant Tenant { get; set; } = null!;
}

public sealed class TrashRecord : BaseEntity
{
    [MaxLength(160)] public string EntityType { get; set; } = null!;
    [MaxLength(160)] public string EntityId { get; set; } = null!;
    [MaxLength(300)] public string DisplayName { get; set; } = null!;
    [MaxLength(120)] public string? DeletedByUserId { get; set; }
    [MaxLength(180)] public string? DeletedByName { get; set; }
    public string? SnapshotJson { get; set; }
    public DateTime? RestoredAt { get; set; }
    [MaxLength(120)] public string? RestoredByUserId { get; set; }
    public DateTime? PurgedAt { get; set; }
}
