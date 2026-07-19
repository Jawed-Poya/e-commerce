using ECommerce.Entities.Common;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Entities.Orders.Filters;

namespace ECommerce.Services.Orders;

public interface IOrderService
{
    CheckoutConfigurationResponse GetCheckoutConfiguration();

    Task<OrderConfirmationResponse> CreateAsync(
        CreateCheckoutOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<PagedResult<OrderListItemResponse>> GetAsync(
        OrderFilter filter,
        CancellationToken cancellationToken = default);

    Task<OrderDetailsResponse?> GetByIdAsync(
        long id,
        CancellationToken cancellationToken = default);

    Task<OrderDetailsResponse> UpdateStatusAsync(
        long id,
        UpdateOrderStatusRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<OrderDetailsResponse> UpdatePaymentStatusAsync(
        long id,
        UpdatePaymentStatusRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<OrderTrackingResponse?> TrackAsync(
        string orderNumber,
        string phone,
        CancellationToken cancellationToken = default);
}
