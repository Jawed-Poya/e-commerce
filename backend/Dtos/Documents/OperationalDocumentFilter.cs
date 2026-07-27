namespace ECommerce.Dtos.Documents;

public sealed record OperationalDocumentFilter(
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    long? BranchId = null,
    string? CurrencyCode = null,
    string? Search = null);
