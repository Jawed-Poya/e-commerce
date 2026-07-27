namespace ECommerce.Dtos.Documents;

public sealed record ReceiptItemResponse(
    string Name,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Tax,
    decimal Total);

public sealed record ReceiptResponse(
    string Source,
    long Id,
    string Reference,
    DateTime Date,
    string CompanyName,
    string? LegalName,
    string? CompanyPhone,
    string? CompanyEmail,
    string? CompanyAddress,
    string? LogoUrl,
    string? BranchName,
    string CustomerName,
    string? CustomerPhone,
    string? CustomerAddress,
    string CurrencyCode,
    decimal Subtotal,
    decimal Discount,
    decimal Tax,
    decimal Shipping,
    decimal Total,
    decimal PaidAmount,
    decimal BalanceAmount,
    string PaymentStatus,
    string? PaymentMethod,
    string? Notes,
    IReadOnlyCollection<ReceiptItemResponse> Items);
