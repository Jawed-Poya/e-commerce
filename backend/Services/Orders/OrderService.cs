using System.Security.Cryptography;
using System.Text.Json;
using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Entities.Orders.Filters;
using ECommerce.Entities.Users;
using ECommerce.Options;
using ECommerce.Shared;
using ECommerce.Services.Customers;
using ECommerce.Services.Inventory;
using ECommerce.Services.Notifications;
using ECommerce.Services.Storefront;
using ECommerce.Services.Company;
using ECommerce.Services.Accounting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using OrderEntity = API.Entities.Orders.Order;
using OrderStatus = ECommerce.Entities.Orders.OrderStatus;

namespace ECommerce.Services.Orders;

public sealed class OrderService(
    ApplicationDbContext context,
    IOptions<CommerceOptions> commerceOptions,
    ICurrentCustomerAccessor currentCustomer,
    UserManager<User> userManager,
    IDefaultCustomerTypeResolver defaultCustomerType,
    IStoreNotificationService notifications,
    StorePushDeliveryQueue pushQueue,
    IAdminNotificationService adminNotifications,
    IStorefrontContentService storefrontContent,
    IInventoryCostService inventoryCosts,
    IOrderInventoryService orderInventory,
    IAccountingPostingService accounting,
    IOptions<WhatsAppOptions> whatsAppOptions) : IOrderService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly CommerceOptions _options = commerceOptions.Value;
    private readonly WhatsAppOptions _whatsAppOptions = whatsAppOptions.Value;

    public async Task<CheckoutConfigurationResponse> GetCheckoutConfigurationAsync(
        CancellationToken cancellationToken = default)
    {
        var bankDetails = GetBankDetails();
        var content = await storefrontContent.GetAsync(cancellationToken);
        var currency = await GetCompanyCurrencyAsync(cancellationToken);

        return new CheckoutConfigurationResponse(
            currency,
            content.ShippingEnabled,
            Math.Max(0, content.FlatShippingFee),
            Math.Max(0, content.FreeShippingThreshold),
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
        var checkoutUser = await EnsureVerifiedCheckoutUserAsync(request.Customer, cancellationToken);
        var currency = await GetCompanyCurrencyAsync(cancellationToken);

        var groupedItems = request.Items
            .GroupBy(item => new { item.ProductId, item.UnitId })
            .Select(group => new CheckoutItemRequest(
                group.Key.ProductId,
                group.Sum(item => item.Quantity),
                group.Key.UnitId))
            .ToList();

        var productIds = groupedItems.Select(item => item.ProductId).Distinct().ToArray();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var customer = await UpsertCheckoutCustomerAsync(checkoutUser, request.Customer, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            await EnsureCustomerLinkAsync(checkoutUser, customer.Id);

            await UpsertDefaultAddressAsync(customer.Id, request.ShippingAddress, cancellationToken);

            var products = await context.Products
                .Include(product => product.Inventory)
                .Include(product => product.Prices)
                    .ThenInclude(price => price.CustomerType)
                .Include(product => product.Unit)
                .Include(product => product.UnitConversions)
                    .ThenInclude(conversion => conversion.Unit)
                .Where(product => productIds.Contains(product.Id) && product.IsActive)
                .ToListAsync(cancellationToken);

            if (products.Count != productIds.Length)
                throw new InvalidOperationException("One or more products are unavailable.");

            var productById = products.ToDictionary(product => product.Id);
            var expiredAvailableByProduct = await InventoryAvailability.LoadExpiredAvailableByProductAsync(
                context,
                productIds,
                cancellationToken);
            var orderItems = new List<OrderItem>(groupedItems.Count);
            var productCosts = await inventoryCosts.GetCurrentUnitCostsAsync(productIds, cancellationToken);
            var defaultCustomerTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
            var generalDiscountPercent = Math.Clamp(await context.CompanySettings.AsNoTracking()
                .Select(setting => (decimal?)setting.GeneralSalesDiscountPercent)
                .SingleOrDefaultAsync(cancellationToken) ?? 0, 0, 100);

            foreach (var requested in groupedItems)
            {
                var product = productById[requested.ProductId];
                var selectedUnit = ResolveSelectedUnit(product, requested.UnitId);
                ValidateOrderQuantityStep(product.Name, selectedUnit.UnitName, requested.Quantity, product.OrderQuantityStep);
                var baseQuantity = decimal.Round(requested.Quantity * selectedUnit.ConversionFactor, 3);
                if (baseQuantity <= 0)
                    throw new InvalidOperationException("Product quantities must be greater than zero.");

                var configuredBaseUnitPrice = ResolveEffectivePrice(
                    product,
                    customer.CustomerTypeId,
                    defaultCustomerTypeId,
                    today)
                    ?? throw new InvalidOperationException($"No active price is configured for '{product.Name}'.");
                var baseUnitPrice = decimal.Round(
                    configuredBaseUnitPrice * (1 - generalDiscountPercent / 100m),
                    6,
                    MidpointRounding.AwayFromZero);
                var sellingUnitPrice = decimal.Round(baseUnitPrice * selectedUnit.ConversionFactor, 2);
                var normalizedBasePrice = decimal.Round(sellingUnitPrice / selectedUnit.ConversionFactor, 6);

                orderItems.Add(new OrderItem
                {
                    ProductId = product.Id,
                    Quantity = baseQuantity,
                    OrderedQuantity = requested.Quantity,
                    SelectedUnitId = selectedUnit.UnitId,
                    SelectedUnitName = selectedUnit.UnitName,
                    UnitConversionFactor = selectedUnit.ConversionFactor,
                    SellingUnitPrice = sellingUnitPrice,
                    UnitPrice = normalizedBasePrice,
                    UnitCost = productCosts.GetValueOrDefault(product.Id),
                    AffectsInventory = !product.UsesDisplayStock,
                    Discount = 0,
                    Tax = 0,
                    ProductName = string.IsNullOrWhiteSpace(product.Strength)
                        ? product.Name
                        : $"{product.Name} — {product.Strength}",
                    ProductBarcode = selectedUnit.Barcode ?? product.Barcode,
                    Currency = currency
                });
            }

            foreach (var productGroup in orderItems.GroupBy(item => item.ProductId))
            {
                var product = productById[productGroup.Key];
                var requiredBaseQuantity = productGroup.Sum(item => item.Quantity);
                ValidateRequestedQuantity(product, requiredBaseQuantity);
                if (product.UsesDisplayStock)
                {
                    var displayQuantity = Math.Max(0, product.DisplayStockQuantity ?? 0);
                    if (displayQuantity < requiredBaseQuantity)
                        throw new InvalidOperationException(
                            $"Only {displayQuantity:N3} base unit(s) of '{product.Name}' are currently available to order.");
                }
                else
                {
                    var expiredAvailable = expiredAvailableByProduct.GetValueOrDefault(product.Id);
                    var sellableAvailable = product.Inventory is null
                        ? 0
                        : InventoryAvailability.SellableAvailable(
                            product.Inventory.Quantity,
                            product.Inventory.ReservedQuantity,
                            expiredAvailable);
                    if (sellableAvailable < requiredBaseQuantity)
                    {
                        throw new InvalidOperationException(
                            $"Only {sellableAvailable:N3} unexpired base unit(s) of '{product.Name}' are available. Expired stock cannot be ordered.");
                    }
                }
            }

            var subtotal = orderItems.Sum(item => item.OrderedQuantity * item.SellingUnitPrice);
            var shippingRules = await storefrontContent.GetAsync(cancellationToken);
            var freeThreshold = Math.Max(0, shippingRules.FreeShippingThreshold);
            var qualifiesForFreeShipping = freeThreshold > 0 && subtotal >= freeThreshold;
            var shippingTotal = !shippingRules.ShippingEnabled || qualifiesForFreeShipping
                ? 0
                : Math.Max(0, shippingRules.FlatShippingFee);
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
                Currency = currency,
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
                        Currency = currency,
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

            await orderInventory.ReserveAsync(
                order,
                userId: null,
                cancellationToken: cancellationToken);

            var adminNotification = await adminNotifications.CreateOrderCreatedAsync(
                order.Id,
                order.OrderNumber,
                BuildName(customer.FirstName, customer.LastName),
                order.Total,
                order.Currency,
                cancellationToken);

            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await adminNotifications.PublishAsync(adminNotification, CancellationToken.None);

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
            WhatsAppLinkBuilder.BuildOrder(
                row.Phone,
                BuildName(row.FirstName, row.LastName),
                row.OrderNumber,
                _whatsAppOptions),
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
        return order is null ? null : await MapDetailsWithLotsAsync(order, cancellationToken);
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
            {
                await transaction.RollbackAsync(cancellationToken);
                return await MapDetailsWithLotsAsync(order, cancellationToken);
            }

            EnsureValidStatusTransition(order, request.Status);
            var previousStatus = order.Status;
            var pendingNotifications = new List<PendingStoreNotification?>();

            if (request.Status == OrderStatus.Cancelled)
            {
                var restockedProducts = await orderInventory.ReleaseReservationsAsync(
                    order, userId, cancellationToken);
                foreach (var restocked in restockedProducts)
                {
                    pendingNotifications.Add(await notifications.CreateStockIncreasedAsync(
                        restocked.ProductId,
                        restocked.PreviousAvailable,
                        restocked.NewAvailable,
                        cancellationToken));
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
                // Older/demo processing orders may not have been reserved when
                // they were created. Reserve idempotently before fulfillment so
                // an existing reservation is kept as-is, while a missing one is
                // repaired safely from currently sellable FEFO lots.
                await orderInventory.ReserveAsync(
                    order, userId, cancellationToken);

                // Persist a newly-created reservation inside the same database
                // transaction before committing it. This lets the commit step
                // consume the exact lot movements that were just reserved.
                await context.SaveChangesAsync(cancellationToken);

                await orderInventory.CommitReservationsAsync(
                    order, userId, cancellationToken);
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
            order.UpdatedAt = DateTime.UtcNow;
            order.StatusHistory.Add(new OrderStatusHistory
            {
                FromStatus = previousStatus,
                ToStatus = request.Status,
                Note = CleanOptional(request.Note),
                ChangedByUserId = CleanOptional(userId)
            });

            if (request.Status == OrderStatus.Delivered)
            {
                await accounting.PostOnlineSaleAsync(order, userId, cancellationToken);
                foreach (var paidPayment in order.Payments.Where(item =>
                             item.Status is PaymentStatus.Paid or PaymentStatus.PartiallyRefunded))
                    await accounting.PostOnlinePaymentAsync(order, paidPayment, userId, cancellationToken);
            }

            var adminNotification = await adminNotifications.CreateOrderStatusChangedAsync(
                order.Id,
                order.OrderNumber,
                request.Status.ToString(),
                cancellationToken);

            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await notifications.PublishAsync(pendingNotifications, CancellationToken.None);
            await adminNotifications.PublishAsync(adminNotification, CancellationToken.None);
            pushQueue.Enqueue(new StorePushDelivery(
                null,
                null,
                new CustomerOrderPush(order.CustomerId, order.OrderNumber, request.Status.ToString())));

            return await MapDetailsWithLotsAsync(order, cancellationToken);
        }
        catch (DbUpdateException exception) when (SqlServerExceptionClassifier.IsUniqueConstraintViolation(
                   exception,
                   "IX_InventoryTransactions_IdempotencyKey"))
        {
            await transaction.RollbackAsync(cancellationToken);
            context.ChangeTracker.Clear();

            // A concurrent request may have completed the same transition first.
            // Return the committed state instead of exposing a SQL index error.
            var current = await LoadOrderAsync(id, false, cancellationToken);
            if (current?.Status == request.Status) return await MapDetailsWithLotsAsync(current, cancellationToken);

            throw new InvalidOperationException(
                "This order inventory action was already processed. Refresh the order and try again.");
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);
            context.ChangeTracker.Clear();

            var current = await LoadOrderAsync(id, false, cancellationToken);
            if (current?.Status == request.Status) return await MapDetailsWithLotsAsync(current, cancellationToken);

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

        if (order.Status == OrderStatus.Delivered &&
            request.Status is PaymentStatus.Paid or PaymentStatus.PartiallyRefunded)
            await accounting.PostOnlinePaymentAsync(order, payment, userId, cancellationToken);
        order.StatusHistory.Add(new OrderStatusHistory
        {
            FromStatus = order.Status,
            ToStatus = order.Status,
            Note = $"Payment changed to {request.Status}." +
                (string.IsNullOrWhiteSpace(userId) ? string.Empty : $" By {userId}."),
            ChangedByUserId = CleanOptional(userId)
        });

        var adminNotification = await adminNotifications.CreatePaymentStatusChangedAsync(
            order.Id,
            order.OrderNumber,
            request.Status.ToString(),
            cancellationToken);

        await context.SaveChangesAsync(cancellationToken);
        await adminNotifications.PublishAsync(adminNotification, CancellationToken.None);
        return await MapDetailsWithLotsAsync(order, cancellationToken);
    }

    public async Task<OrderTrackingResponse?> TrackAsync(
        string orderNumber,
        string? phone,
        CancellationToken cancellationToken = default)
    {
        var normalizedOrderNumber = orderNumber.Trim();
        if (normalizedOrderNumber.Length == 0)
            return null;

        var query = context.Orders
            .AsNoTracking()
            .Include(item => item.StatusHistory)
            .Include(item => item.Customer);

        OrderEntity? order;
        if (currentCustomer.IsAuthenticated)
        {
            var customerId = await ResolveCurrentCustomerIdAsync(cancellationToken);
            if (!customerId.HasValue)
                return null;

            order = await query.FirstOrDefaultAsync(item =>
                item.OrderNumber == normalizedOrderNumber &&
                item.CustomerId == customerId.Value,
                cancellationToken);
        }
        else
        {
            var normalizedPhone = NormalizePhone(phone ?? string.Empty);
            if (normalizedPhone.Length == 0)
                return null;

            order = await query.FirstOrDefaultAsync(item =>
                item.OrderNumber == normalizedOrderNumber &&
                item.Customer.Phone == normalizedPhone,
                cancellationToken);
        }

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

    public async Task<PagedResult<OrderListItemResponse>> GetMyOrdersAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var customerId = await ResolveCurrentCustomerIdAsync(cancellationToken)
            ?? throw new UnauthorizedAccessException("A customer account is required.");

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 50);

        var query = context.Orders
            .AsNoTracking()
            .Where(order => order.CustomerId == customerId);

        var totalCount = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(order => order.CreatedAt)
            .ThenByDescending(order => order.Id)
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
                Provider = order.Payments.OrderByDescending(payment => payment.Id)
                    .Select(payment => payment.Provider).FirstOrDefault(),
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
            WhatsAppLinkBuilder.BuildOrder(
                row.Phone,
                BuildName(row.FirstName, row.LastName),
                row.OrderNumber,
                _whatsAppOptions),
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

    public async Task<OrderDetailsResponse?> GetMyOrderAsync(
        string orderNumber,
        CancellationToken cancellationToken = default)
    {
        var customerId = await ResolveCurrentCustomerIdAsync(cancellationToken)
            ?? throw new UnauthorizedAccessException("A customer account is required.");

        var order = await context.Orders
            .AsNoTracking()
            .Include(item => item.Customer)
                .ThenInclude(customer => customer.CustomerType)
            .Include(item => item.Items)
            .Include(item => item.Payments)
            .Include(item => item.StatusHistory)
            .FirstOrDefaultAsync(item =>
                item.CustomerId == customerId &&
                item.OrderNumber == orderNumber.Trim(),
                cancellationToken);

        return order is null ? null : MapDetails(order, []);
    }

    private async Task<User> EnsureVerifiedCheckoutUserAsync(
        CheckoutCustomerRequest customer,
        CancellationToken cancellationToken)
    {
        if (!currentCustomer.IsAuthenticated || string.IsNullOrWhiteSpace(currentCustomer.UserId))
            throw new UnauthorizedAccessException("Sign in before placing an order.");

        var user = await userManager.FindByIdAsync(currentCustomer.UserId)
            ?? throw new UnauthorizedAccessException("Your account could not be found.");
        if (!user.IsActive)
            throw new UnauthorizedAccessException("Your account is inactive.");

        var email = NormalizeEmail(customer.Email);
        var verifiedEmailMatches = user.EmailConfirmed &&
            !string.IsNullOrWhiteSpace(user.Email) &&
            string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase);

        if (!verifiedEmailMatches)
            throw new UnauthorizedAccessException(
                "Verify the email address used for this order before checkout.");
        return user;
    }


    private async Task<long?> ResolveCurrentCustomerIdAsync(CancellationToken cancellationToken)
    {
        if (currentCustomer.CustomerId.HasValue)
            return currentCustomer.CustomerId.Value;
        if (!currentCustomer.IsAuthenticated || string.IsNullOrWhiteSpace(currentCustomer.UserId))
            return null;

        var user = await userManager.FindByIdAsync(currentCustomer.UserId);
        return user is null ? null : await GetLinkedCustomerIdAsync(user);
    }

    private async Task<long?> GetLinkedCustomerIdAsync(User user)
    {
        var claims = await userManager.GetClaimsAsync(user);
        return long.TryParse(
            claims.FirstOrDefault(claim => claim.Type == AuthClaims.CustomerId)?.Value,
            out var customerId)
            ? customerId
            : null;
    }

    private async Task EnsureCustomerLinkAsync(User user, long customerId)
    {
        var claims = await userManager.GetClaimsAsync(user);
        var existing = claims.FirstOrDefault(claim => claim.Type == AuthClaims.CustomerId);
        if (existing?.Value == customerId.ToString()) return;
        if (existing is not null)
        {
            var remove = await userManager.RemoveClaimAsync(user, existing);
            if (!remove.Succeeded)
                throw new InvalidOperationException("Could not update the customer account link.");
        }
        var add = await userManager.AddClaimAsync(user, new Claim(AuthClaims.CustomerId, customerId.ToString()));
        if (!add.Succeeded)
            throw new InvalidOperationException("Could not link the order to your customer account.");
    }

    private async Task<Customer> UpsertCheckoutCustomerAsync(
        User user,
        CheckoutCustomerRequest request,
        CancellationToken cancellationToken)
    {
        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);
        var linkedCustomerId = currentCustomer.CustomerId ?? await GetLinkedCustomerIdAsync(user);
        Customer? customer;
        if (linkedCustomerId.HasValue)
        {
            customer = await context.Customers.FirstOrDefaultAsync(
                item => item.Id == linkedCustomerId.Value, cancellationToken);
        }
        else
        {
            var matchingCustomers = await context.Customers
                .Where(item => item.Phone == phone || (email != null && item.Email == email))
                .Take(2)
                .ToListAsync(cancellationToken);
            if (matchingCustomers.Count > 1)
                throw new InvalidOperationException(
                    "The order email and phone belong to different customer records. Ask an administrator to merge them first.");
            customer = matchingCustomers.SingleOrDefault();
        }

        if (await context.Customers.AnyAsync(
                item => item.Phone == phone && (customer == null || item.Id != customer.Id),
                cancellationToken))
            throw new InvalidOperationException("This phone number already belongs to another customer.");
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
            customer.Phone = phone;
            customer.Email = email ?? customer.Email;
            customer.UpdatedAt = DateTime.UtcNow;
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

        if (!string.IsNullOrWhiteSpace(request.Customer.Email))
            _ = NormalizeEmail(request.Customer.Email);

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
    }

    private static SelectedProductUnit ResolveSelectedUnit(Product product, long? requestedUnitId)
    {
        if (!product.UnitId.HasValue || product.Unit is null)
        {
            if (requestedUnitId.HasValue)
                throw new InvalidOperationException($"A base unit is not configured for '{product.Name}'.");
            return new SelectedProductUnit(null, "Unit", 1, product.Barcode);
        }

        if (!requestedUnitId.HasValue || requestedUnitId.Value == product.UnitId.Value)
            return new SelectedProductUnit(product.UnitId, product.Unit.Name, 1, product.Barcode);

        var conversion = product.UnitConversions.FirstOrDefault(item =>
            item.UnitId == requestedUnitId.Value && item.IsActive);
        if (conversion is null)
            throw new InvalidOperationException($"The selected selling unit is not available for '{product.Name}'.");

        return new SelectedProductUnit(
            conversion.UnitId,
            conversion.Unit.Name,
            conversion.ConversionFactor,
            conversion.Barcode);
    }

    private sealed record SelectedProductUnit(
        long? UnitId,
        string UnitName,
        decimal ConversionFactor,
        string? Barcode);

    private static void ValidateOrderQuantityStep(
        string productName,
        string unitName,
        decimal quantity,
        decimal step)
    {
        var normalizedStep = step <= 0 ? 1 : step;
        if (quantity < normalizedStep || decimal.Remainder(quantity, normalizedStep) != 0)
        {
            throw new InvalidOperationException(
                $"'{productName}' must be ordered in increments of {normalizedStep:N3} {unitName}. Adjust the cart quantity and try again.");
        }
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

    private async Task<OrderDetailsResponse> MapDetailsWithLotsAsync(
        OrderEntity order,
        CancellationToken cancellationToken)
    {
        var lotMovements = await context.InventoryTransactionLots
            .AsNoTracking()
            .Where(item =>
                item.InventoryTransaction.ReferenceType == "Order" &&
                item.InventoryTransaction.ReferenceId == order.Id)
            .OrderBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Select(item => new OrderLotMovementResponse(
                item.Id,
                item.InventoryTransactionId,
                item.InventoryTransaction.ProductId,
                item.InventoryTransaction.Product.Name,
                item.InventoryTransaction.Type,
                item.InventoryLotId,
                item.LotNumber,
                item.WarehouseId,
                item.WarehouseName,
                item.ExpiresAt,
                item.QuantityDelta,
                item.ReservedDelta,
                item.CreatedAt))
            .ToListAsync(cancellationToken);

        return MapDetails(order, lotMovements);
    }

    private OrderDetailsResponse MapDetails(
        OrderEntity order,
        IReadOnlyCollection<OrderLotMovementResponse> lotMovements)
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
                WhatsAppLinkBuilder.BuildOrder(
                    order.Customer.Phone,
                    BuildName(order.Customer.FirstName, order.Customer.LastName),
                    order.OrderNumber,
                    _whatsAppOptions),
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
                    item.OrderedQuantity > 0 ? item.OrderedQuantity : item.Quantity,
                    item.SelectedUnitId,
                    item.SelectedUnitName,
                    item.UnitConversionFactor > 0 ? item.UnitConversionFactor : 1,
                    item.SellingUnitPrice > 0 ? item.SellingUnitPrice : item.UnitPrice,
                    item.Discount,
                    item.Tax,
                    item.Total,
                    item.Currency))
                .ToList(),
            lotMovements,
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

    private static string? NormalizeEmail(string? value)
    {
        var clean = CleanOptional(value)?.ToLowerInvariant();
        if (clean is null) return null;
        if (!MailAddress.TryCreate(clean, out var address) ||
            !string.Equals(address.Address, clean, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Enter a valid email address.");
        return address.Address.ToLowerInvariant();
    }


    private async Task<string> GetCompanyCurrencyAsync(CancellationToken cancellationToken)
    {
        var currency = await context.CompanySettings.AsNoTracking()
            .Select(item => item.MainCurrencyCode)
            .FirstOrDefaultAsync(cancellationToken);
        return NormalizeCurrency(currency ?? _options.Currency);
    }

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
