using ECommerce.Entities;
using ECommerce.Entities.Dashboard.Contracts;
using ECommerce.Services.Dashboard;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Policy = AppPermissions.DashboardView)]
public sealed class DashboardController(IAdminDashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<AdminDashboardResponse>>> Get(
        CancellationToken cancellationToken)
    {
        return Ok(ApiResponse<AdminDashboardResponse>.Ok(
            await dashboard.GetAsync(cancellationToken)));
    }
}
