using System.Security.Cryptography;
using System.Text.Json;
using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Entities.Orders.Filters;
using ECommerce.Entities.Products;
using ECommerce.Options;
using ECommerce.Services.Customers;
using ECommerce.Services.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OrderEntity = API.Entities.Orders.Order;
using OrderStatus = ECommerce.Entities.Orders.OrderStatus;

namespace ECommerce.Services.Orders;

public sealed class OrderService(
    ApplicationDbContext context,
    IOptions<CommerceOptions> commerceOptions,
    ICurrentCustomerAccessor currentCustomer,
    IDefaultCustomerTypeResolver defaultCustomerType,
    IStoreNotificationService notifications) : IOrderService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly CommerceOptions _options = commerceOptions.Value;

    public CheckoutConfigurationResponse GetCheckoutConfiguration()
    {
        var bankDetails = GetBankDetails();

        return new CheckoutConfigurationResponse(
            NormalizeCurrency(_options.Currency),
            Math.Max(0, _options.FlatShippingFee),
            Math.Max(0, _options.FreeShippingThreshold),
            [
                new PaymentOptionResponse(
                    PaymentMethod.CashOnDelivery,
                    "Cash on delivery",
                    "Pay in cash when the order is delivered.",
                    false,
                    null),
                new PaymentOptionResponse(
                    PaymentMethod.BankTransfer,
                    "Bank transfer",
                    "Transfer manually to the configured bank account. The admin verifies the payment before processing.",
                    true,
                    bankDetails)
            ]);
    }

    public async Task<OrderConfirmationResponse> CreateAsync(
        CreateCheckoutOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateCheckoutRequest(request);

        var groupedItems = request.Items
            .GroupBy(item => item.ProductId)
            .Select(group => new CheckoutItemRequest(
                group.Key,
                group.Sum(item => item.Quantity)))
            .ToList();

        var productIds = groupedItems.Select(item => item.ProductId).ToArray();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var customer = await UpsertCheckoutCustomerAsync(request.Customer, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);

            await UpsertDefaultAddressAsync(customer.Id, request.ShippingAddress, cancellationToken);

            var products = await context.Products
                .Include(product => product.Inventory)
                .Include(product => product.Prices)
                    .ThenInclude(price => price.CustomerType)
                .Where(product => productIds.Contains(product.Id) && product.IsActive)
                .ToListAsync(cancellationToken);

            if (products.Count != productIds.Length)
                throw new InvalidOperationException("One or more products are unavailable.");

            var requestByProductId = groupedItems.ToDictionary(item => item.ProductId);
            var orderItems = new List<OrderItem>(products.Count);
            var defaultCustomerTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);

            foreach (var product in products)
            {
                var requested = requestByProductId[product.Id];
                ValidateRequestedQuantity(product, requested.Quantity);

                if (product.Inventory is null || product.Inventory.AvailableQuantity < requested.Quantity)
                    throw new InvalidOperationException($"Insufficient stock for '{product.Name}'.");

                var unitPrice = ResolveEffectivePrice(
                    product,
                    customer.CustomerTypeId,
                    defaultCustomerTypeId,
                    today)
                    ?? throw new InvalidOperationException($"No active price is configured for '{product.Name}'.");

                orderItems.Add(new OrderItem
                {
                    ProductId = product.Id,
                    Quantity = requested.Quantity,
                    UnitPrice = unitPrice,
                    Discount = 0,
                    Tax = 0,
                    ProductName = product.Name,
                    ProductBarcode = product.Barcode,
                    Currency = NormalizeCurrency(_options.Currency)
                });
            }

            var subtotal = orderItems.Sum(item => item.Quantity * item.UnitPrice);
            var shippingTotal = subtotal >= Math.Max(0, _options.FreeShippingThreshold)
                ? 0
                : Math.Max(0, _options.FlatShippingFee);
            var total = subtotal + shippingTotal;
            var now = DateTime.UtcNow;

            var order = new OrderEntity
            {
                OrderNumber = await GenerateOrderNumberAsync(cancellationToken),
                CustomerId = customer.Id,
                Status = OrderStatus.Pending,
                PaymentStatus = PaymentStatus.Pending,
                FulfillmentStatus = FulfillmentStatus.Unfulfilled,
                Subtotal = subtotal,
                DiscountTotal = 0,
                TaxTotal = 0,
                ShippingTotal = shippingTotal,
                Total = total,
                Currency = NormalizeCurrency(_options.Currency),
                ReservationExpiresAt = now.AddMinutes(Math.Max(30, _options.ReservationMinutes)),
                ShippingAddressJson = JsonSerializer.Serialize(request.ShippingAddress, JsonOptions),
                BillingAddressJson = JsonSerializer.Serialize(request.ShippingAddress, JsonOptions),
                Notes = CleanOptional(request.Notes),
                Items = orderItems,
                Payments =
                [
                    new Payment
                    {
                        Provider = request.PaymentMethod.ToString(),
                        ExternalReference = request.PaymentMethod == PaymentMethod.BankTransfer
                            ? CleanOptional(request.BankTransferReference)
                            : null,
                        Amount = total,
                        Currency = NormalizeCurrency(_options.Currency),
                        Status = PaymentStatus.Pending
                    }
                ],
                StatusHistory =
                [
                    new OrderStatusHistory
                    {
                        FromStatus = OrderStatus.Pending,
                        ToStatus = OrderStatus.Pending,
                        Note = "Order created from storefront checkout."
                    }
                ]
            };

            context.Orders.Add(order);
            await context.SaveChangesAsync(cancellationToken);

            foreach (var product in products)
            {
                var quantity = requestByProductId[product.Id].Quantity;
                var inventory = product.Inventory;
                var quantityBefore = inventory.Quantity;
                var reservedBefore = inventory.ReservedQuantity;

                inventory.ReservedQuantity += quantity;

                context.InventoryTransactions.Add(new InventoryTransaction
                {
                    ProductId = product.Id,
                    Type = InventoryTransactionType.Reservation,
                    Quantity = 0,
                    QuantityBefore = quantityBefore,
                    QuantityAfter = quantityBefore,
                    ReservedBefore = reservedBefore,
                    ReservedAfter = inventory.ReservedQuantity,
                    ReferenceType = "Order",
                    ReferenceId = order.Id,
                    IdempotencyKey = $"order:{order.Id}:reserve:{product.Id}",
                    Description = $"Stock reserved for order {order.OrderNumber}."
                });
            }

            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new OrderConfirmationResponse(
                order.Id,
                order.OrderNumber,
                order.Status,
                order.PaymentStatus,
                request.PaymentMethod,
                order.Subtotal,
                order.ShippingTotal,
                order.Total,
                order.Currency,
                order.CreatedAt,
                order.ReservationExpiresAt,
                request.PaymentMethod == PaymentMethod.BankTransfer ? GetBankDetails() : null);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException(
                "Stock changed while the order was being created. Please review the cart and try again.");
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<PagedResult<OrderListItemResponse>> GetAsync(
        OrderFilter filter,
        CancellationToken cancellationToken = default)
    {
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var query = context.Orders.AsNoTracking().AsQueryable();
        var search = CleanOptional(filter.Search);

        if (search is not null)
        {
            query = query.Where(order =>
                order.OrderNumber.Contains(search) ||
                order.Customer.FirstName.Contains(search) ||
                (order.Customer.LastName != null && order.Customer.LastName.Contains(search)) ||
                order.Customer.Phone.Contains(search));
        }

        if (filter.Status.HasValue)
            query = query.Where(order => order.Status == filter.Status.Value);

        if (filter.PaymentStatus.HasValue)
            query = query.Where(order => order.PaymentStatus == filter.PaymentStatus.Value);

        if (filter.PaymentMethod.HasValue)
        {
            var provider = filter.PaymentMethod.Value.ToString();
            query = query.Where(order => order.Payments.Any(payment => payment.Provider == provider));
        }

        if (filter.From.HasValue)
            query = query.Where(order => order.CreatedAt >= filter.From.Value);

        if (filter.To.HasValue)
            query = query.Where(order => order.CreatedAt <= filter.To.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(order => order.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(order => new
            {
                order.Id,
                order.OrderNumber,
                order.Customer.FirstName,
                order.Customer.LastName,
                order.Customer.Phone,
                order.Status,
                order.PaymentStatus,
                Provider = order.Payments
                    .OrderByDescending(payment => payment.Id)
                    .Select(payment => payment.Provider)
                    .FirstOrDefault(),
                order.Total,
                order.Currency,
                ItemCount = order.Items.Count,
                order.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(row => new OrderListItemResponse(
            row.Id,
            row.OrderNumber,
            BuildName(row.FirstName, row.LastName),
            row.Phone,
            row.Status,
            row.PaymentStatus,
            ParsePaymentMethod(row.Provider),
            row.Total,
            row.Currency,
            row.ItemCount,
            row.CreatedAt)).ToList();

        return new PagedResult<OrderListItemResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<OrderDetailsResponse?> GetByIdAsync(
        long id,
        CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(id, false, cancellationToken);
        return order is null ? null : MapDetails(order);
    }

    public async Task<OrderDetailsResponse> UpdateStatusAsync(
        long id,
        UpdateOrderStatusRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var order = await LoadOrderAsync(id, true, cancellationToken)
                ?? throw new KeyNotFoundException("Order not found.");

            if (order.Status == request.Status)
                return MapDetails(order);

            EnsureValidStatusTransition(order, request.Status);
            var previousStatus = order.Status;

            if (request.Status == OrderStatus.Cancelled)
            {
                var restockedProducts = ReleaseReservedStock(order);
                foreach (var restocked in restockedProducts)
                {
                    await notifications.CreateStockIncreasedAsync(
                        restocked.ProductId,
                        restocked.PreviousAvailable,
                        restocked.NewAvailable,
                        cancellationToken);
                }
                order.FulfillmentStatus = FulfillmentStatus.Cancelled;

                var payment = order.Payments.OrderByDescending(item => item.Id).FirstOrDefault();
                if (payment is not null && payment.Status is PaymentStatus.Pending or PaymentStatus.Authorized)
                {
                    payment.Status = PaymentStatus.Cancelled;
                    order.PaymentStatus = PaymentStatus.Cancelled;
                }
            }
            else if (request.Status == OrderStatus.Confirmed)
            {
                var paymentMethod = ParsePaymentMethod(
                    order.Payments.OrderByDescending(item => item.Id).Select(item => item.Provider).FirstOrDefault());

                if (paymentMethod == PaymentMethod.BankTransfer && order.PaymentStatus != PaymentStatus.Paid)
                    throw new InvalidOperationException(
                        "Verify the bank transfer before confirming this order.");
            }
            else if (request.Status == OrderStatus.Processing)
            {
                order.FulfillmentStatus = FulfillmentStatus.Processing;
            }
            else if (request.Status == OrderStatus.Delivered)
            {
                CommitReservedStock(order);
                order.FulfillmentStatus = FulfillmentStatus.Fulfilled;

                var payment = order.Payments.OrderByDescending(item => item.Id).FirstOrDefault();
                if (payment is not null && ParsePaymentMethod(payment.Provider) == PaymentMethod.CashOnDelivery)
                {
                    payment.Status = PaymentStatus.Paid;
                    payment.PaidAt = DateTime.UtcNow;
                    payment.FailureReason = null;
                    order.PaymentStatus = PaymentStatus.Paid;
                }
            }

            order.Status = request.Status;
            order.StatusHistory.Add(new OrderStatusHistory
            {
                FromStatus = previousStatus,
                ToStatus = request.Status,
                Note = CleanOptional(request.Note),
                ChangedByUserId = CleanOptional(userId)
            });

            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return MapDetails(order);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException(
                "Inventory changed while the order was being updated. Refresh and try again.");
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<OrderDetailsResponse> UpdatePaymentStatusAsync(
        long id,
        UpdatePaymentStatusRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(id, true, cancellationToken)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.Status == OrderStatus.Cancelled && request.Status == PaymentStatus.Paid)
            throw new InvalidOperationException("A cancelled order cannot be marked as paid.");

        var payment = order.Payments.OrderByDescending(item => item.Id).FirstOrDefault()
            ?? throw new InvalidOperationException("This order has no payment record.");

        payment.Status = request.Status;
        payment.ExternalReference = CleanOptional(request.ExternalReference) ?? payment.ExternalReference;
        payment.FailureReason = request.Status == PaymentStatus.Failed
            ? CleanOptional(request.FailureReason) ?? "Payment verification failed."
            : null;
        payment.PaidAt = request.Status == PaymentStatus.Paid
            ? payment.PaidAt ?? DateTime.UtcNow
            : null;

        order.PaymentStatus = request.Status;
        order.StatusHistory.Add(new OrderStatusHistory
        {
            FromStatus = order.Status,
            ToStatus = order.Status,
            Note = $"Payment changed to {request.Status}." +
                (string.IsNullOrWhiteSpace(userId) ? string.Empty : $" By {userId}."),
            ChangedByUserId = CleanOptional(userId)
        });

        await context.SaveChangesAsync(cancellationToken);
        return MapDetails(order);
    }

    public async Task<OrderTrackingResponse?> TrackAsync(
        string orderNumber,
        string phone,
        CancellationToken cancellationToken = default)
    {
        var normalizedOrderNumber = orderNumber.Trim();
        var normalizedPhone = NormalizePhone(phone);

        if (normalizedOrderNumber.Length == 0 || normalizedPhone.Length == 0)
            return null;

        var order = await context.Orders
            .AsNoTracking()
            .Include(item => item.StatusHistory)
            .Include(item => item.Customer)
            .FirstOrDefaultAsync(item =>
                item.OrderNumber == normalizedOrderNumber &&
                item.Customer.Phone == normalizedPhone,
                cancellationToken);

        if (order is null)
            return null;

        return new OrderTrackingResponse(
            order.OrderNumber,
            order.Status,
            order.PaymentStatus,
            order.FulfillmentStatus,
            order.Total,
            order.Currency,
            order.CreatedAt,
            order.UpdatedAt,
            order.StatusHistory
                .OrderBy(item => item.CreatedAt)
                .Select(MapHistory)
                .ToList());
    }

    public async Task<IReadOnlyCollection<OrderListItemResponse>> GetMyOrdersAsync(
        CancellationToken cancellationToken = default)
    {
        if (!currentCustomer.CustomerId.HasValue)
            throw new UnauthorizedAccessException("A customer account is required.");

        var rows = await context.Orders
            .AsNoTracking()
            .Where(order => order.CustomerId == currentCustomer.CustomerId.Value)
            .OrderByDescending(order => order.CreatedAt)
            .Take(100)
            .Select(order => new
            {
                order.Id,
                order.OrderNumber,
                order.Customer.FirstName,
                order.Customer.LastName,
                order.Customer.Phone,
                order.Status,
                order.PaymentStatus,
                Provider = order.Payments.OrderByDescending(payment => payment.Id)
                    .Select(payment => payment.Provider).FirstOrDefault(),
                order.Total,
                order.Currency,
                ItemCount = order.Items.Count,
                order.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return rows.Select(row => new OrderListItemResponse(
            row.Id,
            row.OrderNumber,
            BuildName(row.FirstName, row.LastName),
            row.Phone,
            row.Status,
            row.PaymentStatus,
            ParsePaymentMethod(row.Provider),
            row.Total,
            row.Currency,
            row.ItemCount,
            row.CreatedAt)).ToList();
    }

    public async Task<OrderDetailsResponse?> GetMyOrderAsync(
        string orderNumber,
        CancellationToken cancellationToken = default)
    {
        if (!currentCustomer.CustomerId.HasValue)
            throw new UnauthorizedAccessException("A customer account is required.");

        var order = await context.Orders
            .AsNoTracking()
            .Include(item => item.Customer)
                .ThenInclude(customer => customer.CustomerType)
            .Include(item => item.Items)
            .Include(item => item.Payments)
            .Include(item => item.StatusHistory)
            .FirstOrDefaultAsync(item =>
                item.CustomerId == currentCustomer.CustomerId.Value &&
                item.OrderNumber == orderNumber.Trim(),
                cancellationToken);

        return order is null ? null : MapDetails(order);
    }

    private async Task<Customer> UpsertCheckoutCustomerAsync(
        CheckoutCustomerRequest request,
        CancellationToken cancellationToken)
    {
        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);
        var customer = currentCustomer.CustomerId.HasValue
            ? await context.Customers.FirstOrDefaultAsync(
                item => item.Id == currentCustomer.CustomerId.Value, cancellationToken)
            : await context.Customers.FirstOrDefaultAsync(
                item => item.Phone == phone, cancellationToken);

        if (email is not null && await context.Customers.AnyAsync(
                item => item.Email == email && (customer == null || item.Id != customer.Id),
                cancellationToken))
            throw new InvalidOperationException("This email address already belongs to another customer.");

        if (customer is null)
        {
            customer = new Customer
            {
                FirstName = request.FirstName.Trim(),
                LastName = CleanOptional(request.LastName),
                Phone = phone,
                Email = email,
                CustomerTypeId = await defaultCustomerType.GetIdAsync(cancellationToken)
            };
            context.Customers.Add(customer);
        }
        else
        {
            customer.FirstName = request.FirstName.Trim();
            customer.LastName = CleanOptional(request.LastName);
            customer.Email = email ?? customer.Email;
        }

        return customer;
    }

    private async Task UpsertDefaultAddressAsync(
        long customerId,
        CheckoutAddressRequest request,
        CancellationToken cancellationToken)
    {
        var address = await context.CustomerAddresses
            .FirstOrDefaultAsync(item => item.CustomerId == customerId && item.IsDefaultShipping,
                cancellationToken);

        if (address is null)
        {
            address = new CustomerAddress
            {
                CustomerId = customerId,
                IsDefaultShipping = true,
                IsDefaultBilling = true
            };
            context.CustomerAddresses.Add(address);
        }

        address.Label = string.IsNullOrWhiteSpace(request.Label) ? "Home" : request.Label.Trim();
        address.RecipientName = request.RecipientName.Trim();
        address.Phone = NormalizePhone(request.Phone);
        address.AddressLine1 = request.AddressLine1.Trim();
        address.AddressLine2 = CleanOptional(request.AddressLine2);
        address.City = request.City.Trim();
        address.State = CleanOptional(request.State);
        address.Country = request.Country.Trim();
        address.PostalCode = CleanOptional(request.PostalCode);

        var customer = await context.Customers.SingleAsync(item => item.Id == customerId, cancellationToken);
        customer.Address = string.Join(", ", new[]
        {
            address.AddressLine1,
            address.AddressLine2,
            address.City,
            address.State,
            address.Country,
            address.PostalCode
        }.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private async Task<string> GenerateOrderNumberAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var value = $"ORD-{DateTime.UtcNow:yyyyMMdd}-{RandomNumberGenerator.GetInt32(100000, 1000000)}";
            if (!await context.Orders.IgnoreQueryFilters().AnyAsync(item => item.OrderNumber == value, cancellationToken))
                return value;
        }

        return $"ORD-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..32];
    }

    private async Task<OrderEntity?> LoadOrderAsync(
        long id,
        bool tracked,
        CancellationToken cancellationToken)
    {
        IQueryable<OrderEntity> query = context.Orders
            .Include(order => order.Customer)
                .ThenInclude(customer => customer.CustomerType)
            .Include(order => order.Items)
            .Include(order => order.Payments)
            .Include(order => order.StatusHistory);

        if (!tracked)
            query = query.AsNoTracking();

        return await query.FirstOrDefaultAsync(order => order.Id == id, cancellationToken);
    }

    private IReadOnlyCollection<RestockedProduct> ReleaseReservedStock(OrderEntity order)
    {
        var productIds = order.Items.Select(item => item.ProductId).Distinct().ToArray();
        var inventories = context.ProductInventories
            .Where(item => productIds.Contains(item.ProductId))
            .ToDictionary(item => item.ProductId);
        var restockedProducts = new List<RestockedProduct>();

        foreach (var item in order.Items)
        {
            if (!inventories.TryGetValue(item.ProductId, out var inventory) ||
                inventory.ReservedQuantity < item.Quantity)
                throw new InvalidOperationException($"Reserved stock is inconsistent for '{item.ProductName}'.");

            var reservedBefore = inventory.ReservedQuantity;
            var previousAvailable = inventory.Quantity - reservedBefore;
            inventory.ReservedQuantity -= item.Quantity;
            var newAvailable = inventory.Quantity - inventory.ReservedQuantity;
            restockedProducts.Add(new RestockedProduct(item.ProductId, previousAvailable, newAvailable));

            context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = item.ProductId,
                Type = InventoryTransactionType.ReservationRelease,
                Quantity = 0,
                QuantityBefore = inventory.Quantity,
                QuantityAfter = inventory.Quantity,
                ReservedBefore = reservedBefore,
                ReservedAfter = inventory.ReservedQuantity,
                ReferenceType = "Order",
                ReferenceId = order.Id,
                IdempotencyKey = $"order:{order.Id}:release:{item.ProductId}",
                Description = $"Reservation released for cancelled order {order.OrderNumber}."
            });
        }

        return restockedProducts;
    }

    private sealed record RestockedProduct(
        long ProductId,
        decimal PreviousAvailable,
        decimal NewAvailable);

    private void CommitReservedStock(OrderEntity order)
    {
        var productIds = order.Items.Select(item => item.ProductId).Distinct().ToArray();
        var inventories = context.ProductInventories
            .Where(item => productIds.Contains(item.ProductId))
            .ToDictionary(item => item.ProductId);

        foreach (var item in order.Items)
        {
            if (!inventories.TryGetValue(item.ProductId, out var inventory) ||
                inventory.ReservedQuantity < item.Quantity ||
                inventory.Quantity < item.Quantity)
                throw new InvalidOperationException($"Reserved stock is inconsistent for '{item.ProductName}'.");

            var quantityBefore = inventory.Quantity;
            var reservedBefore = inventory.ReservedQuantity;
            inventory.Quantity -= item.Quantity;
            inventory.ReservedQuantity -= item.Quantity;

            context.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = item.ProductId,
                Type = InventoryTransactionType.Sale,
                Quantity = -item.Quantity,
                QuantityBefore = quantityBefore,
                QuantityAfter = inventory.Quantity,
                ReservedBefore = reservedBefore,
                ReservedAfter = inventory.ReservedQuantity,
                ReferenceType = "Order",
                ReferenceId = order.Id,
                IdempotencyKey = $"order:{order.Id}:sale:{item.ProductId}",
                Description = $"Stock sold for delivered order {order.OrderNumber}."
            });
        }
    }

    private static void EnsureValidStatusTransition(OrderEntity order, OrderStatus target)
    {
        var valid = order.Status switch
        {
            OrderStatus.Pending => target is OrderStatus.Confirmed or OrderStatus.Cancelled,
            OrderStatus.Confirmed => target is OrderStatus.Processing or OrderStatus.Cancelled,
            OrderStatus.Processing => target is OrderStatus.Delivered or OrderStatus.Cancelled,
            _ => false
        };

        if (!valid)
            throw new InvalidOperationException(
                $"Order cannot move from {order.Status} to {target}.");
    }

    private static void ValidateCheckoutRequest(CreateCheckoutOrderRequest request)
    {
        ArgumentNullException.ThrowIfNull(request.Customer);
        ArgumentNullException.ThrowIfNull(request.ShippingAddress);

        if (string.IsNullOrWhiteSpace(request.Customer.FirstName))
            throw new ArgumentException("Customer first name is required.");

        if (NormalizePhone(request.Customer.Phone).Length < 6)
            throw new ArgumentException("Enter a valid customer phone number.");

        if (!string.IsNullOrWhiteSpace(request.Customer.Email) &&
            !request.Customer.Email.Contains('@'))
            throw new ArgumentException("Enter a valid email address.");

        if (string.IsNullOrWhiteSpace(request.ShippingAddress.RecipientName) ||
            string.IsNullOrWhiteSpace(request.ShippingAddress.AddressLine1) ||
            string.IsNullOrWhiteSpace(request.ShippingAddress.City) ||
            string.IsNullOrWhiteSpace(request.ShippingAddress.Country))
            throw new ArgumentException("Complete the required shipping address fields.");

        if (request.Items.Count == 0)
            throw new ArgumentException("The cart is empty.");

        if (request.Items.Any(item => item.ProductId <= 0 || item.Quantity <= 0))
            throw new ArgumentException("Every cart item must have a valid product and quantity.");

        if (!Enum.IsDefined(request.PaymentMethod))
            throw new ArgumentException("Choose a valid payment method.");

        if (request.PaymentMethod == PaymentMethod.BankTransfer &&
            string.IsNullOrWhiteSpace(request.BankTransferReference))
            throw new ArgumentException("Enter the bank transaction reference.");
    }

    private static void ValidateRequestedQuantity(Product product, decimal quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException($"Quantity for '{product.Name}' must be greater than zero.");

        if (product.MinimumValue.HasValue && quantity < product.MinimumValue.Value)
            throw new InvalidOperationException(
                $"The minimum order quantity for '{product.Name}' is {product.MinimumValue.Value}.");

        if (product.MaximumValue.HasValue && quantity > product.MaximumValue.Value)
            throw new InvalidOperationException(
                $"The maximum order quantity for '{product.Name}' is {product.MaximumValue.Value}.");
    }

    private static decimal? ResolveEffectivePrice(
        Product product,
        long? customerTypeId,
        long defaultCustomerTypeId,
        DateOnly today)
    {
        var selected = customerTypeId.HasValue
            ? product.Prices.FirstOrDefault(price => price.CustomerTypeId == customerTypeId.Value)
            : null;

        selected ??= product.Prices.FirstOrDefault(
            price => price.CustomerTypeId == defaultCustomerTypeId);

        if (selected is null) return null;

        var saleIsActive = selected.SalePrice.HasValue &&
            (!selected.StartDate.HasValue || selected.StartDate.Value <= today) &&
            (!selected.EndDate.HasValue || selected.EndDate.Value >= today);

        return saleIsActive ? selected.SalePrice!.Value : selected.RegularPrice;
    }

    private OrderDetailsResponse MapDetails(OrderEntity order)
    {
        var address = DeserializeAddress(order.ShippingAddressJson);

        return new OrderDetailsResponse(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.PaymentStatus,
            order.FulfillmentStatus,
            order.Subtotal,
            order.DiscountTotal,
            order.TaxTotal,
            order.ShippingTotal,
            order.Total,
            order.Currency,
            order.Notes,
            order.CreatedAt,
            order.UpdatedAt,
            order.ReservationExpiresAt,
            new OrderCustomerResponse(
                order.Customer.Id,
                BuildName(order.Customer.FirstName, order.Customer.LastName),
                order.Customer.Phone,
                order.Customer.Email,
                order.Customer.CustomerType?.Name),
            address,
            order.Items
                .OrderBy(item => item.Id)
                .Select(item => new OrderItemResponse(
                    item.Id,
                    item.ProductId,
                    item.ProductName,
                    item.ProductBarcode,
                    item.Quantity,
                    item.UnitPrice,
                    item.Discount,
                    item.Tax,
                    item.Total,
                    item.Currency))
                .ToList(),
            order.Payments
                .OrderByDescending(item => item.Id)
                .Select(item => new PaymentResponse(
                    item.Id,
                    ParsePaymentMethod(item.Provider),
                    item.Provider,
                    item.ExternalReference,
                    item.Amount,
                    item.Currency,
                    item.Status,
                    item.PaidAt,
                    item.FailureReason,
                    item.CreatedAt))
                .ToList(),
            order.StatusHistory
                .OrderBy(item => item.CreatedAt)
                .Select(MapHistory)
                .ToList());
    }

    private static OrderAddressResponse DeserializeAddress(string? json)
    {
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                var request = JsonSerializer.Deserialize<CheckoutAddressRequest>(json, JsonOptions);
                if (request is not null)
                {
                    return new OrderAddressResponse(
                        request.Label,
                        request.RecipientName,
                        request.Phone,
                        request.AddressLine1,
                        request.AddressLine2,
                        request.City,
                        request.State,
                        request.Country,
                        request.PostalCode);
                }
            }
            catch (JsonException)
            {
                // Older records may contain a different address snapshot format.
            }
        }

        return new OrderAddressResponse(
            "Shipping",
            "Unknown recipient",
            string.Empty,
            "Address unavailable",
            null,
            string.Empty,
            null,
            string.Empty,
            null);
    }

    private BankTransferDetailsResponse GetBankDetails() => new(
        _options.BankTransfer.BankName,
        _options.BankTransfer.AccountName,
        _options.BankTransfer.AccountNumber,
        CleanOptional(_options.BankTransfer.Iban),
        _options.BankTransfer.Instructions);

    private static OrderStatusHistoryResponse MapHistory(OrderStatusHistory item) => new(
        item.Id,
        item.FromStatus,
        item.ToStatus,
        item.Note,
        item.ChangedByUserId,
        item.CreatedAt);

    private static PaymentMethod ParsePaymentMethod(string? provider) =>
        Enum.TryParse<PaymentMethod>(provider, true, out var result)
            ? result
            : PaymentMethod.CashOnDelivery;

    private static string NormalizePhone(string value) =>
        new(value.Trim().Where(character =>
            char.IsDigit(character) || character == '+').ToArray());

    private static string? NormalizeEmail(string? value) =>
        CleanOptional(value)?.ToLowerInvariant();

    private static string NormalizeCurrency(string? value)
    {
        var currency = string.IsNullOrWhiteSpace(value) ? "USD" : value.Trim().ToUpperInvariant();
        return currency.Length <= 3 ? currency : currency[..3];
    }

    private static string BuildName(string firstName, string? lastName) =>
        string.Join(' ', new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value)));

    private static string? CleanOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
