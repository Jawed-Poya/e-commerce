using ECommerce.Entities.Dashboard.Contracts;

namespace ECommerce.Services.Dashboard;

public interface IAdminDashboardService
{
    Task<AdminDashboardResponse> GetAsync(CancellationToken cancellationToken = default);
}
