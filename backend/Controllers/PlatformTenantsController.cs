using ECommerce.Dtos.Tenancy;
using ECommerce.Entities;
using ECommerce.Services.Tenancy;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/platform")]
[Authorize(Policy = AppPermissions.PlatformTenantsManage)]
public sealed class PlatformTenantsController(
    ITenantManagementService tenants,
    IPlatformManagementService platform) : ControllerBase
{
    [HttpGet("tenants")]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<TenantProfileResponse>>>> Get(CancellationToken cancellationToken) =>
        Ok(ApiResponse<IReadOnlyCollection<TenantProfileResponse>>.Ok(await tenants.GetTenantsAsync(cancellationToken)));

    [HttpPost("tenants")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> Create(CreateTenantRequest request, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<TenantProfileResponse>.Ok(await tenants.CreateTenantAsync(request, cancellationToken), "Company created."));

    [HttpPut("tenants/{id:long}")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> Update(long id, PlatformUpdateTenantRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.UpdateTenantAsync(id, request, cancellationToken), "Company settings, site link, and permissions updated."));

    [HttpPut("tenants/{id:long}/subscription")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> UpdateSubscription(long id, UpdateTenantSubscriptionRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.UpdateSubscriptionAsync(id, request, cancellationToken), "Subscription and tenant limits updated."));

    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<PlatformSettingsResponse>>> GetSettings(CancellationToken cancellationToken) =>
        Ok(ApiResponse<PlatformSettingsResponse>.Ok(await platform.GetSettingsAsync(cancellationToken)));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<PlatformSettingsResponse>>> UpdateSettings(UpdatePlatformSettingsRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<PlatformSettingsResponse>.Ok(await platform.UpdateSettingsAsync(request, cancellationToken), "Platform site routing settings updated."));

    [HttpGet("plans")]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<SubscriptionPlanResponse>>>> GetPlans([FromQuery] bool includeInactive = true, CancellationToken cancellationToken = default) =>
        Ok(ApiResponse<IReadOnlyCollection<SubscriptionPlanResponse>>.Ok(await platform.GetPlansAsync(includeInactive, cancellationToken)));

    [HttpPost("plans")]
    public async Task<ActionResult<ApiResponse<SubscriptionPlanResponse>>> CreatePlan(UpsertSubscriptionPlanRequest request, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<SubscriptionPlanResponse>.Ok(await platform.CreatePlanAsync(request, cancellationToken), "Subscription plan created."));

    [HttpPut("plans/{id:long}")]
    public async Task<ActionResult<ApiResponse<SubscriptionPlanResponse>>> UpdatePlan(long id, UpsertSubscriptionPlanRequest request, CancellationToken cancellationToken) =>
        Ok(ApiResponse<SubscriptionPlanResponse>.Ok(await platform.UpdatePlanAsync(id, request, cancellationToken), "Subscription plan updated."));

    [HttpDelete("plans/{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> ArchivePlan(long id, CancellationToken cancellationToken)
    {
        await platform.ArchivePlanAsync(id, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { id }, "Subscription plan archived."));
    }
}
