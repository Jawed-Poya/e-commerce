using API.Entities.Customers;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Entities.Customers.Filters;
using ECommerce.Entities.Orders;
using ECommerce.Options;
using ECommerce.Services.Auditing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Customers;

public sealed class CustomerService(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerType,
    ECommerce.Services.Company.IRecordDeletionPolicy deletionPolicy,
    StorePresenceTracker presence,
    IOptions<WhatsAppOptions> whatsAppOptions) : ICustomerService
{
    private readonly WhatsAppOptions _whatsAppOptions = whatsAppOptions.Value;

    public async Task<PagedResult<CustomerListItemResponse>> GetAsync(
        CustomerFilter filter,
        CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var companyDebtLimit = await context.CompanySettings.AsNoTracking()
            .Select(item => item.MaximumCustomerDebt)
            .SingleOrDefaultAsync(cancellationToken);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
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
                ManualSales = context.InventorySales
                    .Where(sale => sale.CustomerId == customer.Id)
                    .Sum(sale => (decimal?)(sale.Total - sale.ReturnedAmount)) ?? 0,
                OutstandingDebt = context.InventorySales
                    .Where(sale => sale.CustomerId == customer.Id && sale.Total - sale.ReturnedAmount > sale.PaidAmount)
                    .Sum(sale => (decimal?)(sale.Total - sale.ReturnedAmount - sale.PaidAmount)) ?? 0,
                customer.AccountCredit,
                CreditLimit = customer.CreditLimit ?? companyDebtLimit,
                HasOverdueDebt = context.InventorySales.Any(sale =>
                    sale.CustomerId == customer.Id && sale.Total - sale.ReturnedAmount > sale.PaidAmount &&
                    sale.DebtDueDate.HasValue && sale.DebtDueDate.Value < today),
                LastOrderAt = customer.Orders
                    .OrderByDescending(order => order.CreatedAt)
                    .Select(order => (DateTime?)order.CreatedAt)
                    .FirstOrDefault(),
                customer.CreatedAt
            })
            .ToListAsync(cancellationToken);
        var activeCustomers = presence.GetActive(DateTime.UtcNow)
            .Where(session => session.CustomerId.HasValue)
            .GroupBy(session => session.CustomerId!.Value)
            .ToDictionary(group => group.Key, group => group.Count());

        return new PagedResult<CustomerListItemResponse>
        {
            Items = rows.Select(row =>
            {
                var name = BuildName(row.FirstName, row.LastName);
                return new CustomerListItemResponse(
                    row.Id,
                    name,
                    row.Phone,
                    WhatsAppLinkBuilder.Build(row.Phone, name, _whatsAppOptions),
                    row.Email,
                    row.CustomerTypeName,
                    row.OrderCount,
                    row.TotalSpent + row.ManualSales,
                    row.OutstandingDebt,
                    row.AccountCredit,
                    row.CreditLimit,
                    row.HasOverdueDebt,
                    activeCustomers.ContainsKey(row.Id),
                    activeCustomers.GetValueOrDefault(row.Id),
                    row.LastOrderAt,
                    row.CreatedAt);
            }).ToList(),
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

        if (customer is null) return null;
        var policy = await context.CompanySettings.AsNoTracking()
            .Select(item => new { item.MaximumCustomerDebt, item.DefaultDebtDueDays })
            .SingleOrDefaultAsync(cancellationToken);
        var outstandingDebt = await context.InventorySales.AsNoTracking()
            .Where(sale => sale.CustomerId == id && sale.Total - sale.ReturnedAmount > sale.PaidAmount)
            .SumAsync(sale => (decimal?)(sale.Total - sale.ReturnedAmount - sale.PaidAmount), cancellationToken) ?? 0;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var hasOverdueDebt = await context.InventorySales.AsNoTracking().AnyAsync(sale =>
            sale.CustomerId == id && sale.Total - sale.ReturnedAmount > sale.PaidAmount &&
            sale.DebtDueDate.HasValue && sale.DebtDueDate.Value < today,
            cancellationToken);
        return MapDetails(
            customer,
            outstandingDebt,
            customer.CreditLimit ?? policy?.MaximumCustomerDebt ?? 300000,
            customer.DebtDueDays ?? policy?.DefaultDebtDueDays ?? 30,
            hasOverdueDebt);
    }

    public async Task<CustomerEngagementResponse?> GetEngagementAsync(
        long id,
        CancellationToken cancellationToken = default)
    {
        if (!await context.Customers.AsNoTracking().AnyAsync(customer => customer.Id == id, cancellationToken))
            return null;

        var now = DateTime.UtcNow;
        var cutoff = now.AddDays(-30);
        var summary = await context.CustomerVisitLogs
            .AsNoTracking()
            .Where(visit => visit.CustomerId == id && visit.CreatedAt >= cutoff)
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Visits = group.Count(),
                UniqueSessions = group.Select(visit => visit.SessionId).Distinct().Count(),
                ProductViews = group.Count(visit => visit.Path.StartsWith("/products/")),
                Searches = group.Count(visit => visit.Path.Contains("search=")),
                LastSeenAt = (DateTime?)group.Max(visit => visit.CreatedAt)
            })
            .SingleOrDefaultAsync(cancellationToken);
        var lastVisit = await context.CustomerVisitLogs
            .AsNoTracking()
            .Where(visit => visit.CustomerId == id)
            .OrderByDescending(visit => visit.CreatedAt)
            .Select(visit => new { visit.Path, visit.CreatedAt })
            .FirstOrDefaultAsync(cancellationToken);
        var lastSearchPath = await context.CustomerVisitLogs
            .AsNoTracking()
            .Where(visit => visit.CustomerId == id && visit.Path.Contains("search="))
            .OrderByDescending(visit => visit.CreatedAt)
            .Select(visit => visit.Path)
            .FirstOrDefaultAsync(cancellationToken);
        var active = presence.GetActive(now)
            .Where(visitor => visitor.CustomerId == id)
            .OrderByDescending(visitor => visitor.LastSeenAt)
            .ToArray();
        var current = active.FirstOrDefault();

        return new CustomerEngagementResponse(
            id,
            active.Length > 0,
            active.Length,
            current?.CurrentPath ?? lastVisit?.Path,
            current?.PageTitle,
            current?.LastSeenAt ?? lastVisit?.CreatedAt ?? summary?.LastSeenAt,
            summary?.Visits ?? 0,
            summary?.UniqueSessions ?? 0,
            summary?.ProductViews ?? 0,
            summary?.Searches ?? 0,
            QueryValue(lastSearchPath, "search"));
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
            CustomerTypeId = customerTypeId,
            CreditLimit = request.CreditLimit,
            DebtDueDays = request.DebtDueDays
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
        customer.CreditLimit = request.CreditLimit;
        customer.DebtDueDays = request.DebtDueDays;

        await context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(customer.Id, cancellationToken)
            ?? throw new InvalidOperationException("Customer could not be loaded after update.");
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken = default)
    {
        var customer = await context.Customers
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Customer not found.");

        await deletionPolicy.EnsureCustomerCanBeArchivedAsync(id, cancellationToken);

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
        if (request.CreditLimit is < 0)
            throw new ArgumentException("Customer credit limit cannot be negative.");
        if (request.DebtDueDays is < 0 or > 3650)
            throw new ArgumentException("Customer debt due days must be between 0 and 3650.");
    }

    private CustomerDetailsResponse MapDetails(
        Customer customer,
        decimal outstandingDebt,
        decimal creditLimit,
        int debtDueDays,
        bool hasOverdueDebt)
    {
        var name = BuildName(customer.FirstName, customer.LastName);

        return new CustomerDetailsResponse(
            customer.Id,
            customer.FirstName,
            customer.LastName,
            customer.Phone,
            WhatsAppLinkBuilder.Build(customer.Phone, name, _whatsAppOptions),
            customer.Email,
            customer.Address,
            customer.CustomerTypeId,
            customer.CustomerType?.Name,
            outstandingDebt,
            customer.AccountCredit,
            creditLimit,
            debtDueDays,
            hasOverdueDebt,
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
    }

    private static string NormalizePhone(string value) =>
        new(value.Trim().Where(character =>
            char.IsDigit(character) || character == '+').ToArray());

    private static string? NormalizeEmail(string? value) =>
        CleanOptional(value)?.ToLowerInvariant();

    private static string BuildName(string firstName, string? lastName) =>
        string.Join(' ', new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value)));

    private static string? CleanOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? QueryValue(string? path, string name)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        var index = path.IndexOf('?');
        if (index < 0 || index == path.Length - 1) return null;
        foreach (var pair in path[(index + 1)..].Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var separator = pair.IndexOf('=');
            var key = separator < 0 ? pair : pair[..separator];
            if (!Uri.UnescapeDataString(key).Equals(name, StringComparison.OrdinalIgnoreCase)) continue;
            var raw = separator < 0 ? string.Empty : pair[(separator + 1)..];
            return Uri.UnescapeDataString(raw.Replace('+', ' ')).Trim();
        }

        return null;
    }
}
