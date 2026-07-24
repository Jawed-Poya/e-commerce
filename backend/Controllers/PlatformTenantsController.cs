using ECommerce.Dtos.Tenancy;
using ECommerce.Entities;
using ECommerce.Entities.Tenancy;
using ECommerce.Services.Tenancy;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/platform/tenants")]
[Authorize(Policy = AppPermissions.PlatformTenantsManage)]
public sealed class PlatformTenantsController(ITenantManagementService tenants) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<TenantProfileResponse>>>> Get(CancellationToken cancellationToken) =>
        Ok(ApiResponse<IReadOnlyCollection<TenantProfileResponse>>.Ok(await tenants.GetTenantsAsync(cancellationToken)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> Create(CreateTenantRequest request, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<TenantProfileResponse>.Ok(await tenants.CreateTenantAsync(request, cancellationToken), "Company created."));

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> Update(
        long id,
        PlatformUpdateTenantRequest request,
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.UpdateTenantAsync(id, request, cancellationToken), "Company settings and permissions updated."));

    [HttpPut("{id:long}/subscription")]
    public async Task<ActionResult<ApiResponse<TenantProfileResponse>>> UpdateSubscription(
        long id,
        UpdateSubscriptionRequest request,
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<TenantProfileResponse>.Ok(await tenants.UpdateSubscriptionAsync(id, request.Plan, request.Status, request.EndsAt, cancellationToken), "Subscription updated."));
}

public sealed record UpdateSubscriptionRequest(TenantPlan Plan, SubscriptionStatus Status, DateTime? EndsAt);
