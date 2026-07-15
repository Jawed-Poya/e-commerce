namespace ECommerce.Controllers;

using API.Entities.Products;
using ECommerce.Entities.Products.Filters;
using ECommerce.Services.Products;
using Microsoft.AspNetCore.Mvc;


[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _service;

    public ProductsController(IProductService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] ProductFilter filter)
    {
        return Ok(await _service.GetAsync(filter));
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        return Ok(await _service.GetByIdAsync(id));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        Product model)
    {
        var id = await _service.CreateAsync(model);

        return Ok(id);
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(
        long id,
        Product model)
    {
        await _service.UpdateAsync(id, model);

        return NoContent();
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        await _service.DeleteAsync(id);

        return NoContent();
    }

    [HttpPatch("{id:long}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(long id)
    {
        await _service.ToggleStatusAsync(id);

        return NoContent();
    }
}
