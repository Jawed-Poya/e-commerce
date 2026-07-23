namespace ECommerce.Entities.Customers.Filters;

public sealed class CustomerFilter
{
    public string? Search { get; set; }

    public long? CustomerTypeId { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;
}
