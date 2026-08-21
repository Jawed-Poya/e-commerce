using System.Text.Json;
using API.Entities.Customers;
using ECommerce.Data;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Services.Notifications;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Customers;

public sealed class CustomerCartService(
    ApplicationDbContext context,
    ICurrentCustomerAccessor currentCustomer,
    IHubContext<StoreNotificationHub> hub,
    ILogger<CustomerCartService> logger) : ICustomerCartService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const int MaximumLines = 100;

    public async Task<CustomerCartResponse> GetAsync(CancellationToken cancellationToken = default)
    {
        var customerId = RequireCustomerId();
        var cart = await context.CustomerCarts
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.CustomerId == customerId, cancellationToken);

        return cart is null
            ? new CustomerCartResponse(0, null, [])
            : ToResponse(cart);
    }

    public async Task<CustomerCartResponse> UpdateAsync(
        UpdateCustomerCartRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Items is null)
            throw new ArgumentException("Cart items are required.");
        if (request.Items.Count > MaximumLines)
            throw new ArgumentException($"A cart can contain at most {MaximumLines} products.");

        var customerId = RequireCustomerId();
        var incoming = Normalize(request.Items);
        var cart = await context.CustomerCarts
            .SingleOrDefaultAsync(item => item.CustomerId == customerId, cancellationToken);
        var currentRevision = cart?.Revision ?? 0;

        if (!request.Merge && request.BaseRevision != currentRevision)
            throw new CustomerCartConflictException();

        var nextItems = request.Merge && cart is not null
            ? Merge(ReadItems(cart.Payload), incoming)
            : incoming;

        if (cart is null)
        {
            cart = new CustomerCart
            {
                CustomerId = customerId,
                Revision = 1,
                Payload = JsonSerializer.Serialize(nextItems, JsonOptions)
            };
            context.CustomerCarts.Add(cart);
        }
        else
        {
            cart.Payload = JsonSerializer.Serialize(nextItems, JsonOptions);
            cart.Revision++;
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new CustomerCartConflictException();
        }
        catch (DbUpdateException)
        {
            // Two clients can create the first cart at the same moment. The unique
            // customer index turns that race into the same recoverable sync conflict.
            throw new CustomerCartConflictException();
        }

        try
        {
            await hub.Clients
                .Group(StoreNotificationGroups.Cart(customerId))
                .SendAsync(
                    "cartUpdated",
                    new { cart.Revision, UpdatedAt = cart.UpdatedAt ?? cart.CreatedAt },
                    cancellationToken);
        }
        catch (Exception exception)
        {
            // The cart snapshot is already committed. Connected clients also poll,
            // so a transient realtime failure must not fail the cart update itself.
            logger.LogWarning(
                exception,
                "Could not publish cart revision {Revision} for customer {CustomerId}.",
                cart.Revision,
                customerId);
        }

        return ToResponse(cart);
    }

    private long RequireCustomerId() => currentCustomer.CustomerId
        ?? throw new UnauthorizedAccessException("A customer account is required.");

    private static List<CustomerCartItemContract> Normalize(
        IEnumerable<CustomerCartItemContract> items)
    {
        var normalized = new Dictionary<(long ProductId, long? UnitId), CustomerCartItemContract>();
        foreach (var item in items)
        {
            if (item.ProductId <= 0 || item.Quantity <= 0)
                continue;
            if (item.Price < 0 || item.Stock < 0)
                throw new ArgumentException("Cart price and stock values cannot be negative.");
            if (item.QuantityStep <= 0)
                throw new ArgumentException("Every cart item must have a positive quantity step.");

            var step = Round(item.QuantityStep);
            var quantity = Round(item.Quantity);
            if (Math.Abs(quantity / step - decimal.Round(quantity / step, 0)) > 0.000001m)
                throw new ArgumentException("Every cart quantity must follow its configured quantity step.");

            var quick = (item.QuickOrderQuantities ?? [])
                .Where(value => value > 0)
                .Select(Round)
                .Distinct()
                .Order()
                .Take(20)
                .ToArray();
            var clean = item with
            {
                Name = Limit(item.Name, 200, "Product"),
                Image = LimitNullable(item.Image, 2048),
                UnitName = LimitNullable(item.UnitName, 100),
                Price = decimal.Round(item.Price, 2),
                Stock = Round(item.Stock),
                QuantityStep = step,
                QuickOrderQuantities = quick,
                Quantity = quantity
            };
            normalized[(clean.ProductId, clean.UnitId)] = clean;
        }

        return normalized.Values.OrderBy(item => item.ProductId).ThenBy(item => item.UnitId).ToList();
    }

    private static List<CustomerCartItemContract> Merge(
        IReadOnlyList<CustomerCartItemContract> current,
        IReadOnlyList<CustomerCartItemContract> incoming)
    {
        var merged = current.ToDictionary(item => (item.ProductId, item.UnitId));
        foreach (var item in incoming)
        {
            merged[(item.ProductId, item.UnitId)] = merged.TryGetValue((item.ProductId, item.UnitId), out var existing)
                ? item with { Quantity = Math.Max(existing.Quantity, item.Quantity) }
                : item;
        }
        return merged.Values.OrderBy(item => item.ProductId).ThenBy(item => item.UnitId).ToList();
    }

    private static CustomerCartResponse ToResponse(CustomerCart cart) =>
        new(cart.Revision, cart.UpdatedAt ?? cart.CreatedAt, ReadItems(cart.Payload));

    private static IReadOnlyList<CustomerCartItemContract> ReadItems(string payload)
    {
        try
        {
            return JsonSerializer.Deserialize<List<CustomerCartItemContract>>(payload, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static decimal Round(decimal value) => decimal.Round(value, 3);

    private static string Limit(string? value, int maximum, string fallback)
    {
        var clean = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        return clean.Length <= maximum ? clean : clean[..maximum];
    }

    private static string? LimitNullable(string? value, int maximum)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var clean = value.Trim();
        return clean.Length <= maximum ? clean : clean[..maximum];
    }
}
