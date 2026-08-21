using ECommerce.Entities;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Services.Customers;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Authorize(Roles = AppRoles.Customer)]
[ApiController]
[Route("api/account/cart")]
public sealed class CustomerCartController(ICustomerCartService carts) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<CustomerCartResponse>>> Get(
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<CustomerCartResponse>.Ok(await carts.GetAsync(cancellationToken)));

    [HttpPut]
    public async Task<ActionResult<ApiResponse<CustomerCartResponse>>> Update(
        UpdateCustomerCartRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<CustomerCartResponse>.Ok(
                await carts.UpdateAsync(request, cancellationToken)));
        }
        catch (CustomerCartConflictException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
