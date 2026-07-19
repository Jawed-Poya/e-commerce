using API.Entities.Customers;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Entities.Customers.Filters;
using ECommerce.Entities.Orders;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Customers;

public sealed class CustomerService(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerType) : ICustomerService
{
    public async Task<PagedResult<CustomerListItemResponse>> GetAsync(
        CustomerFilter filter,
        CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var query = context.Customers.AsNoTracking().AsQueryable();
        var search = CleanOptional(filter.Search);

        if (search is not null)
        {
            query = query.Where(customer =>
                customer.FirstName.Contains(search) ||
                (customer.LastName != null && customer.LastName.Contains(search)) ||
                customer.Phone.Contains(search) ||
                (customer.Email != null && customer.Email.Contains(search)));
        }

        if (filter.CustomerTypeId.HasValue)
            query = query.Where(customer => customer.CustomerTypeId == filter.CustomerTypeId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(customer => customer.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(customer => new
            {
                customer.Id,
                customer.FirstName,
                customer.LastName,
                customer.Phone,
                customer.Email,
                CustomerTypeName = customer.CustomerType == null ? null : customer.CustomerType.Name,
                OrderCount = customer.Orders.Count,
                TotalSpent = customer.Orders
                    .Where(order => order.Status == OrderStatus.Delivered)
                    .Sum(order => (decimal?)order.Total) ?? 0,
                LastOrderAt = customer.Orders
                    .OrderByDescending(order => order.CreatedAt)
                    .Select(order => (DateTime?)order.CreatedAt)
                    .FirstOrDefault(),
                customer.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<CustomerListItemResponse>
        {
            Items = rows.Select(row => new CustomerListItemResponse(
                row.Id,
                BuildName(row.FirstName, row.LastName),
                row.Phone,
                row.Email,
                row.CustomerTypeName,
                row.OrderCount,
                row.TotalSpent,
                row.LastOrderAt,
                row.CreatedAt)).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<CustomerDetailsResponse?> GetByIdAsync(
        long id,
        CancellationToken cancellationToken = default)
    {
        var customer = await context.Customers
            .AsNoTracking()
            .Include(item => item.CustomerType)
            .Include(item => item.Addresses)
            .Include(item => item.Orders)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        return customer is null ? null : MapDetails(customer);
    }

    public async Task<CustomerDetailsResponse> CreateAsync(
        UpsertCustomerRequest request,
        CancellationToken cancellationToken = default)
    {
        Validate(request);
        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);
        await EnsureUniqueAsync(null, phone, email, cancellationToken);
        var customerTypeId = request.CustomerTypeId ??
            await defaultCustomerType.GetIdAsync(cancellationToken);
        await EnsureCustomerTypeExistsAsync(customerTypeId, cancellationToken);

        var customer = new Customer
        {
            FirstName = request.FirstName.Trim(),
            LastName = CleanOptional(request.LastName),
            Phone = phone,
            Email = email,
            Address = CleanOptional(request.Address),
            CustomerTypeId = customerTypeId
        };

        context.Customers.Add(customer);
        await context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(customer.Id, cancellationToken)
            ?? throw new InvalidOperationException("Customer could not be loaded after creation.");
    }

    public async Task<CustomerDetailsResponse> UpdateAsync(
        long id,
        UpsertCustomerRequest request,
        CancellationToken cancellationToken = default)
    {
        Validate(request);
        var customer = await context.Customers
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Customer not found.");

        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);
        await EnsureUniqueAsync(id, phone, email, cancellationToken);
        var customerTypeId = request.CustomerTypeId ??
            await defaultCustomerType.GetIdAsync(cancellationToken);
        await EnsureCustomerTypeExistsAsync(customerTypeId, cancellationToken);

        customer.FirstName = request.FirstName.Trim();
        customer.LastName = CleanOptional(request.LastName);
        customer.Phone = phone;
        customer.Email = email;
        customer.Address = CleanOptional(request.Address);
        customer.CustomerTypeId = customerTypeId;

        await context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(customer.Id, cancellationToken)
            ?? throw new InvalidOperationException("Customer could not be loaded after update.");
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken = default)
    {
        var customer = await context.Customers
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Customer not found.");

        if (await context.Orders.AnyAsync(order => order.CustomerId == id, cancellationToken))
            throw new InvalidOperationException(
                "Customers with order history cannot be deleted. Keep the customer for auditing.");

        customer.IsDeleted = true;
        customer.DeletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureUniqueAsync(
        long? currentId,
        string phone,
        string? email,
        CancellationToken cancellationToken)
    {
        if (await context.Customers.AnyAsync(
                item => item.Phone == phone && (!currentId.HasValue || item.Id != currentId.Value),
                cancellationToken))
            throw new InvalidOperationException("A customer with this phone number already exists.");

        if (email is not null && await context.Customers.AnyAsync(
                item => item.Email == email && (!currentId.HasValue || item.Id != currentId.Value),
                cancellationToken))
            throw new InvalidOperationException("A customer with this email address already exists.");
    }

    private async Task EnsureCustomerTypeExistsAsync(
        long? customerTypeId,
        CancellationToken cancellationToken)
    {
        if (!customerTypeId.HasValue)
            return;

        if (!await context.Types.AnyAsync(
                item => item.Id == customerTypeId.Value &&
                        item.Group == GeneralTypeEnum.CustomerType,
                cancellationToken))
            throw new ArgumentException("The selected customer type does not exist.");
    }

    private static void Validate(UpsertCustomerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName))
            throw new ArgumentException("First name is required.");

        if (NormalizePhone(request.Phone).Length < 6)
            throw new ArgumentException("Enter a valid phone number.");

        if (!string.IsNullOrWhiteSpace(request.Email) && !request.Email.Contains('@'))
            throw new ArgumentException("Enter a valid email address.");
    }

    private static CustomerDetailsResponse MapDetails(Customer customer) => new(
        customer.Id,
        customer.FirstName,
        customer.LastName,
        customer.Phone,
        customer.Email,
        customer.Address,
        customer.CustomerTypeId,
        customer.CustomerType?.Name,
        customer.CreatedAt,
        customer.UpdatedAt,
        customer.Addresses
            .OrderByDescending(address => address.IsDefaultShipping)
            .ThenBy(address => address.Id)
            .Select(address => new CustomerAddressResponse(
                address.Id,
                address.Label,
                address.RecipientName,
                address.Phone,
                address.AddressLine1,
                address.AddressLine2,
                address.City,
                address.State,
                address.Country,
                address.PostalCode,
                address.IsDefaultShipping,
                address.IsDefaultBilling))
            .ToList(),
        customer.Orders
            .OrderByDescending(order => order.CreatedAt)
            .Select(order => new CustomerOrderSummaryResponse(
                order.Id,
                order.OrderNumber,
                order.Status,
                order.Total,
                order.Currency,
                order.CreatedAt))
            .ToList());

    private static string NormalizePhone(string value) =>
        new(value.Trim().Where(character =>
            char.IsDigit(character) || character == '+').ToArray());

    private static string? NormalizeEmail(string? value) =>
        CleanOptional(value)?.ToLowerInvariant();

    private static string BuildName(string firstName, string? lastName) =>
        string.Join(' ', new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value)));

    private static string? CleanOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
