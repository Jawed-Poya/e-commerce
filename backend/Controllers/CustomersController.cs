using ECommerce.Shared;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Entities.Customers.Filters;
using ECommerce.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/customers")]
public sealed class CustomersController(ICustomerService customers) : ControllerBase
{
    [Authorize(Policy = AppPermissions.CustomersView)]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CustomerListItemResponse>>>> Get(
        [FromQuery] CustomerFilter filter,
        CancellationToken cancellationToken)
    {
        var result = await customers.GetAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<CustomerListItemResponse>>.Ok(result));
    }

    [Authorize(Policy = AppPermissions.CustomersView)]
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<CustomerDetailsResponse>>> GetById(
        long id,
        CancellationToken cancellationToken)
    {
        var result = await customers.GetByIdAsync(id, cancellationToken);
        if (result is null)
            return NotFound(ApiResponse<object>.Fail("Customer not found."));

        return Ok(ApiResponse<CustomerDetailsResponse>.Ok(result));
    }

    [Authorize(Policy = AppPermissions.CustomersManage)]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CustomerDetailsResponse>>> Create(
        UpsertCustomerRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await customers.CreateAsync(request, cancellationToken);
            return StatusCode(
                StatusCodes.Status201Created,
                ApiResponse<CustomerDetailsResponse>.Ok(
                    result,
                    "Customer created successfully."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.CustomersManage)]
    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse<CustomerDetailsResponse>>> Update(
        long id,
        UpsertCustomerRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await customers.UpdateAsync(id, request, cancellationToken);
            return Ok(ApiResponse<CustomerDetailsResponse>.Ok(
                result,
                "Customer updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.CustomersManage)]
    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(
        long id,
        CancellationToken cancellationToken)
    {
        try
        {
            await customers.DeleteAsync(id, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { id }, "Customer deleted successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
