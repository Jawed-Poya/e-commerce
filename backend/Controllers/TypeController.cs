using API.Entities.Types;
using ECommerce.Services.GeneralTypes;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/types")]
public class GeneralTypesController : ControllerBase
{
    private readonly IGeneralTypeService _service;

    public GeneralTypesController(
        IGeneralTypeService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(string? group)
    {
        return Ok(new
        {
            data = await _service.GetAsync(group),
            success = true,
            message = ""
        });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id)
    {
        return Ok(await _service.GetByIdAsync(id));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        GeneralType model)
    {
        return Ok(await _service.CreateAsync(model));
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(
        long id,
        GeneralType model)
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
}