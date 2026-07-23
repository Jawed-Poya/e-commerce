namespace ECommerce.Options;

public sealed class CommerceOptions
{
    public const string SectionName = "Commerce";

    public string Currency { get; set; } = "USD";

    public decimal FlatShippingFee { get; set; } = 7.50m;

    public decimal FreeShippingThreshold { get; set; } = 75m;

    public int ReservationMinutes { get; set; } = 1440;

    public long? DefaultCustomerTypeId { get; set; }

    public BankTransferOptions BankTransfer { get; set; } = new();
}

public sealed class BankTransferOptions
{
    public string BankName { get; set; } = "Configure bank name";

    public string AccountName { get; set; } = "Configure account name";

    public string AccountNumber { get; set; } = "Configure account number";

    public string? Iban { get; set; }

    public string Instructions { get; set; } =
        "Transfer the order total and enter the bank transaction reference during checkout.";
}
