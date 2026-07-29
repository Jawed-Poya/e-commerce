using ECommerce.Data;
using ECommerce.Dtos.Prescriptions;
using ECommerce.Entities;
using ECommerce.Entities.Storefront;
using ECommerce.Services.Company;
using ECommerce.Services.Prescriptions;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/prescription-requests")]
public sealed class PrescriptionRequestsController(
    ApplicationDbContext context,
    ICompanyContext companyContext,
    IPrescriptionFileStorage fileStorage) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost]
    [EnableRateLimiting("prescription-upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<PrescriptionRequestCreatedResponse>>> Create(
        [FromForm] CreatePrescriptionRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        using var operation = ServerOperation.CreateWriteScope();
        StoredPrescriptionFile stored;
        try
        {
            stored = await fileStorage.SaveAsync(request.Attachment, operation.Token);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }

        try
        {
            var branchId = await context.Branches
                .AsNoTracking()
                .Where(item =>
                    item.TenantId == companyContext.CompanyId &&
                    item.IsActive)
                .OrderByDescending(item => item.IsMain)
                .ThenBy(item => item.Id)
                .Select(item => (long?)item.Id)
                .FirstOrDefaultAsync(operation.Token);

            var requestNumber = $"RX-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..32]
                .ToUpperInvariant();
            var entity = new PrescriptionRequest
            {
                TenantId = companyContext.CompanyId,
                BranchId = branchId,
                RequestNumber = requestNumber,
                FullName = request.FullName.Trim(),
                Phone = request.Phone.Trim(),
                Email = Clean(request.Email),
                Notes = Clean(request.Notes),
                AttachmentPath = stored.RelativePath,
                OriginalFileName = stored.OriginalFileName,
                ContentType = stored.ContentType,
                FileSize = stored.Size,
                Status = PrescriptionRequestStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            context.PrescriptionRequests.Add(entity);
            await context.SaveChangesAsync(operation.Token);

            var response = new PrescriptionRequestCreatedResponse(
                entity.Id,
                entity.RequestNumber,
                entity.Status,
                entity.CreatedAt);

            return StatusCode(
                StatusCodes.Status201Created,
                ApiResponse<PrescriptionRequestCreatedResponse>.Ok(
                    response,
                    "Prescription request submitted successfully."));
        }
        catch
        {
            try
            {
                await fileStorage.DeleteAsync(stored.RelativePath, CancellationToken.None);
            }
            catch
            {
                // Preserve the original database exception. Orphan cleanup can be
                // handled by normal application maintenance if the file is locked.
            }
            throw;
        }
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
