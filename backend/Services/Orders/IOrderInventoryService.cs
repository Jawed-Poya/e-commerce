using API.Entities.Orders;

namespace ECommerce.Services.Orders;

public sealed record InventoryAvailabilityChange(
    long ProductId,
    decimal PreviousAvailable,
    decimal NewAvailable);

public interface IOrderInventoryService
{
    Task ReserveAsync(
        Order order,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyCollection<InventoryAvailabilityChange>> ReleaseReservationsAsync(
        Order order,
        string? userId,
        CancellationToken cancellationToken = default);

    Task CommitReservationsAsync(
        Order order,
        string? userId,
        CancellationToken cancellationToken = default);
}
