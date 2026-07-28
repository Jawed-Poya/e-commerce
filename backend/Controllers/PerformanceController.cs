using System.Diagnostics;
using ECommerce.Data;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Controllers;

/// <summary>
/// Development-only query benchmark. It never inserts data and is unavailable outside Development.
/// Use backend/Scripts/performance/01-seed-performance-data.sql for deterministic load data.
/// </summary>
[ApiController]
[Route("api/admin/performance")]
[Authorize(Policy = AppPermissions.SystemManage)]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class PerformanceController(
    ApplicationDbContext context,
    IHostEnvironment environment) : ControllerBase
{
    [HttpGet("catalog-query")]
    public async Task<IActionResult> CatalogQuery(
        [FromQuery] int take = 10_000,
        [FromQuery] long? branchId = null)
    {
        if (!environment.IsDevelopment())
            return NotFound();

        take = Math.Clamp(take, 1, 50_000);
        using var operation = ServerOperation.CreateDocumentScope();

        // Execute a tiny warm-up query so connection establishment is not mixed into the measured query.
        await context.Products.AsNoTracking()
            .OrderBy(item => item.Id)
            .Select(item => item.Id)
            .Take(1)
            .ToArrayAsync(operation.Token);

        var memoryBefore = GC.GetTotalMemory(forceFullCollection: false);
        var stopwatch = Stopwatch.StartNew();

        var rows = await context.Products.AsNoTracking()
            .OrderBy(item => item.Name)
            .Select(item => new
            {
                item.Id,
                item.Name,
                item.Barcode,
                Category = item.Category.Name,
                item.UsesDisplayStock,
                item.DisplayStockQuantity,
                Stock = context.ProductInventories
                    .Where(stock => stock.ProductId == item.Id &&
                        (!branchId.HasValue || stock.BranchId == branchId.Value))
                    .Sum(stock => (decimal?)(stock.Quantity - stock.ReservedQuantity)) ?? 0,
                MinimumStock = context.ProductInventories
                    .Where(stock => stock.ProductId == item.Id &&
                        (!branchId.HasValue || stock.BranchId == branchId.Value))
                    .Max(stock => (decimal?)stock.MinimumQuantity) ?? 0,
                Price = context.ProductPrices
                    .Where(price => price.ProductId == item.Id)
                    .OrderBy(price => price.CustomerTypeId)
                    .Select(price => (decimal?)(price.SalePrice ?? price.RegularPrice))
                    .FirstOrDefault()
            })
            .Take(take)
            .ToArrayAsync(operation.Token);

        stopwatch.Stop();
        var memoryAfter = GC.GetTotalMemory(forceFullCollection: false);

        return Ok(new
        {
            requestedRows = take,
            returnedRows = rows.Length,
            elapsedMilliseconds = stopwatch.ElapsedMilliseconds,
            approximateManagedMemoryBytes = Math.Max(0, memoryAfter - memoryBefore),
            physicalStock = rows.Where(item => !item.UsesDisplayStock).Sum(item => item.Stock),
            displayStock = rows.Where(item => item.UsesDisplayStock).Sum(item => item.DisplayStockQuantity ?? 0),
            pricedRows = rows.Count(item => item.Price.HasValue),
            generatedAtUtc = DateTime.UtcNow
        });
    }
}
