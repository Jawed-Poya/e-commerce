using ECommerce.Data;
using ECommerce.Dtos.Prescriptions;
using ECommerce.Entities;
using ECommerce.Entities.Storefront;
using ECommerce.Services.Company;
using ECommerce.Services.Prescriptions;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/prescription-requests")]
[Authorize(Policy = AppPermissions.OrdersView)]
public sealed class AdminPrescriptionRequestsController(
    ApplicationDbContext context,
    ICompanyContext companyContext,
    IPrescriptionFileStorage fileStorage) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedPrescriptionRequestsResponse>>> List(
        [FromQuery] string? search,
        [FromQuery] PrescriptionRequestStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        using var operation = ServerOperation.CreateReadScope();

        var query = context.PrescriptionRequests.AsNoTracking();
        if (companyContext.BranchId.HasValue)
            query = query.Where(item => item.BranchId == companyContext.BranchId.Value);
        if (status.HasValue)
            query = query.Where(item => item.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var value = search.Trim();
            if (value.Length > 120) value = value[..120];
            query = query.Where(item =>
                item.RequestNumber.Contains(value) ||
                item.FullName.Contains(value) ||
                item.Phone.Contains(value) ||
                (item.Email != null && item.Email.Contains(value)));
        }

        var totalCount = await query.CountAsync(operation.Token);
        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(item => new AdminPrescriptionRequestResponse(
                item.Id,
                item.RequestNumber,
                item.FullName,
                item.Phone,
                item.Email,
                item.Notes,
                item.OriginalFileName,
                item.ContentType,
                item.FileSize,
                item.Status,
                item.AdminNotes,
                item.CreatedAt,
                item.UpdatedAt))
            .ToListAsync(operation.Token);

        return Ok(ApiResponse<PagedPrescriptionRequestsResponse>.Ok(
            new PagedPrescriptionRequestsResponse(
                items,
                page,
                pageSize,
                totalCount,
                Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize)))));
    }

    [HttpGet("{id:long}/attachment")]
    public async Task<IActionResult> DownloadAttachment(long id)
    {
        using var operation = ServerOperation.CreateReadScope();
        var query = context.PrescriptionRequests.AsNoTracking().Where(item => item.Id == id);
        if (companyContext.BranchId.HasValue)
            query = query.Where(item => item.BranchId == companyContext.BranchId.Value);

        var item = await query
            .Select(entity => new
            {
                entity.AttachmentPath,
                entity.OriginalFileName,
                entity.ContentType
            })
            .SingleOrDefaultAsync(operation.Token);
        if (item is null) return NotFound();

        try
        {
            var file = fileStorage.OpenRead(item.AttachmentPath);
            return File(file.Stream, item.ContentType ?? file.ContentType, item.OriginalFileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail("The prescription attachment is unavailable."));
        }
    }

    [Authorize(Policy = AppPermissions.OrdersManage)]
    [HttpPatch("{id:long}/status")]
    public async Task<ActionResult<ApiResponse<AdminPrescriptionRequestResponse>>> UpdateStatus(
        long id,
        UpdatePrescriptionRequestStatusRequest request)
    {
        if (!Enum.IsDefined(typeof(PrescriptionRequestStatus), request.Status))
            return BadRequest(ApiResponse<object>.Fail("Select a valid prescription request status."));

        using var operation = ServerOperation.CreateWriteScope();
        var query = context.PrescriptionRequests.Where(item => item.Id == id);
        if (companyContext.BranchId.HasValue)
            query = query.Where(item => item.BranchId == companyContext.BranchId.Value);

        var entity = await query.SingleOrDefaultAsync(operation.Token);
        if (entity is null) return NotFound(ApiResponse<object>.Fail("Prescription request not found."));

        entity.Status = request.Status;
        entity.AdminNotes = string.IsNullOrWhiteSpace(request.AdminNotes)
            ? null
            : request.AdminNotes.Trim();
        entity.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(operation.Token);

        return Ok(ApiResponse<AdminPrescriptionRequestResponse>.Ok(
            Map(entity),
            "Prescription request updated."));
    }

    private static AdminPrescriptionRequestResponse Map(PrescriptionRequest item) => new(
        item.Id,
        item.RequestNumber,
        item.FullName,
        item.Phone,
        item.Email,
        item.Notes,
        item.OriginalFileName,
        item.ContentType,
        item.FileSize,
        item.Status,
        item.AdminNotes,
        item.CreatedAt,
        item.UpdatedAt);
}
