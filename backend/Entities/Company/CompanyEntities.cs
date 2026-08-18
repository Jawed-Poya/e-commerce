using System.ComponentModel.DataAnnotations;
using API.Entities.Common;

namespace ECommerce.Entities.Company;

public sealed class Company
{
    [Key]
    public long Id { get; set; }

    [MaxLength(160)] public string Name { get; set; } = null!;
    [MaxLength(200)] public string? LegalName { get; set; }
    [MaxLength(40)] public string? RegistrationNumber { get; set; }
    [MaxLength(256)] public string? Email { get; set; }
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    [MaxLength(2048)] public string? LogoUrl { get; set; }
    [MaxLength(2048)] public string? FaviconUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public sealed class Branch
{
    [Key] public long Id { get; set; }
    [MaxLength(120)] public string Name { get; set; } = null!;
    [MaxLength(40)] public string Code { get; set; } = null!;
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    public bool IsMain { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public sealed class CompanySetting
{
    [Key] public long Id { get; set; }
    [MaxLength(3)] public string MainCurrencyCode { get; set; } = "USD";
    [MaxLength(8)] public string CurrencySymbol { get; set; } = "$";
    [MaxLength(10)] public string CurrencyPosition { get; set; } = "before";
    public int CurrencyDecimalPlaces { get; set; } = 2;
    [MaxLength(20)] public string AdminPrimaryColor { get; set; } = "#0B1F3A";
    [MaxLength(20)] public string AdminSecondaryColor { get; set; } = "#F97316";
    [MaxLength(20)] public string StorefrontPrimaryColor { get; set; } = "#0B1F3A";
    [MaxLength(20)] public string StorefrontSecondaryColor { get; set; } = "#F97316";
    [MaxLength(120)] public string EnglishFontFamily { get; set; } = "Inter";
    [MaxLength(120)] public string DariFontFamily { get; set; } = "Vazirmatn";
    [MaxLength(120)] public string PashtoFontFamily { get; set; } = "Noto Sans Arabic";
    public int BaseFontSize { get; set; } = 16;
    [MaxLength(500)] public string DefaultQuickOrderQuantitiesJson { get; set; } = "[20,30,40,50]";
    public int TrashRetentionDays { get; set; } = 30;
    public int NotificationRetentionDays { get; set; } = 30;
    public bool ExpiryAlertsEnabled { get; set; } = true;
    [MaxLength(500)] public string ExpiryAlertPeriodsJson { get; set; } = "[30,14,7,3,1,0]";
    public bool ExpiryAlertSoundEnabled { get; set; } = true;
    [MaxLength(40)] public string ExpiryAlertSound { get; set; } = "critical-pulse";
    public int MaximumPurchaseLines { get; set; } = 50;
    public int MaximumManualSaleLines { get; set; } = 50;
    public decimal GeneralSalesDiscountPercent { get; set; }
    public decimal MaximumCustomerDebt { get; set; } = 300000m;
    public int DefaultDebtDueDays { get; set; } = 30;
    public bool AllowNegativeStockSales { get; set; } = true;
    [MaxLength(12)] public string PurchaseNumberPrefix { get; set; } = "PUR";
    public long NextPurchaseNumber { get; set; } = 1;
    public int PurchaseNumberIncrement { get; set; } = 1;
    [MaxLength(12)] public string SaleNumberPrefix { get; set; } = "SAL";
    public long NextSaleNumber { get; set; } = 1;
    public int SaleNumberIncrement { get; set; } = 1;
    public bool AllowUserClaimManagement { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
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
