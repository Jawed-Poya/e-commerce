using ECommerce.Data;
using ECommerce.Entities;
using ECommerce.Services.Company;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Controllers;

public sealed record RestoreDatabaseRequest(string BackupFileName, string Confirmation);
public sealed record ClearBusinessDataRequest(string Scope, long? BranchId, string Confirmation);
public sealed record SeedDemoDataRequest(string Confirmation);

[ApiController]
[Authorize]
[Route("api/admin/maintenance")]
public sealed class DatabaseMaintenanceController(
    IDatabaseMaintenanceService maintenance,
    IDemoDataSeeder demoDataSeeder,
    ApplicationDbContext context) : ControllerBase
{
    [HttpGet("status")]
    [Authorize(Policy = AppPermissions.DatabaseMaintenanceAccessPolicy)]
    public ActionResult<ApiResponse<DatabaseMaintenanceStatus>> GetStatus() =>
        Ok(ApiResponse<DatabaseMaintenanceStatus>.Ok(maintenance.GetStatus()));

    [HttpGet("backups")]
    [Authorize(Policy = AppPermissions.DatabaseBackupReadPolicy)]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<DatabaseBackupInfo>>>> GetBackups(
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<IReadOnlyCollection<DatabaseBackupInfo>>.Ok(
            await maintenance.GetBackupsAsync(cancellationToken)));

    [HttpPost("backups")]
    [Authorize(Policy = AppPermissions.DatabaseBackup)]
    public async Task<ActionResult<ApiResponse<DatabaseBackupInfo>>> CreateBackup(
        CancellationToken cancellationToken)
    {
        var backup = await maintenance.CreateBackupAsync(cancellationToken);
        return Ok(ApiResponse<DatabaseBackupInfo>.Ok(backup, "Database backup created."));
    }

    [HttpPost("restore")]
    [Authorize(Policy = AppPermissions.DatabaseRestore)]
    public async Task<ActionResult<ApiResponse<object>>> Restore(
        RestoreDatabaseRequest request,
        CancellationToken cancellationToken)
    {
        var expected = $"RESTORE {maintenance.GetStatus().DatabaseName}";
        if (!string.Equals(request.Confirmation?.Trim(), expected, StringComparison.Ordinal))
            return BadRequest(ApiResponse<object>.Fail($"Type '{expected}' to confirm the restore."));

        await maintenance.RestoreBackupAsync(request.BackupFileName, cancellationToken);
        return Ok(ApiResponse<object>.Ok(
            new { restored = true, request.BackupFileName },
            "Database restored. Refresh the application and sign in again."));
    }

    [HttpPost("clear")]
    [Authorize(Policy = AppPermissions.BranchDataClear)]
    public async Task<ActionResult<ApiResponse<ClearBusinessDataResult>>> Clear(
        ClearBusinessDataRequest request,
        CancellationToken cancellationToken)
    {
        var scope = request.Scope?.Trim().ToLowerInvariant();
        long? branchId;
        string expected;

        if (scope == "all")
        {
            if (!AppPermissions.IsGranted(User, AppPermissions.AllBusinessDataClear))
                return Forbid();
            branchId = null;
            expected = "CLEAR ALL BUSINESS DATA";
        }
        else if (scope == "branch" && request.BranchId.HasValue)
        {
            var branch = await context.Branches.AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == request.BranchId.Value, cancellationToken);
            if (branch is null)
                return NotFound(ApiResponse<ClearBusinessDataResult>.Fail("The selected branch was not found."));
            branchId = branch.Id;
            expected = $"CLEAR BRANCH {branch.Code}";
        }
        else
        {
            return BadRequest(ApiResponse<ClearBusinessDataResult>.Fail("Choose one branch or all business data."));
        }

        if (!string.Equals(request.Confirmation?.Trim(), expected, StringComparison.Ordinal))
            return BadRequest(ApiResponse<ClearBusinessDataResult>.Fail($"Type '{expected}' to confirm this permanent operation."));

        var result = await maintenance.ClearBusinessDataAsync(branchId, cancellationToken);
        return Ok(ApiResponse<ClearBusinessDataResult>.Ok(result, "Business data cleared."));
    }

    [HttpPost("seed-demo")]
    [Authorize(Policy = AppPermissions.DemoDataSeed)]
    public async Task<ActionResult<ApiResponse<DemoSeedResult>>> SeedDemo(
        SeedDemoDataRequest request,
        CancellationToken cancellationToken)
    {
        if (!AppPermissions.IsGranted(User, AppPermissions.AllBusinessDataClear))
            return Forbid();
        const string expected = "LOAD DEMO DATA";
        if (!string.Equals(request.Confirmation?.Trim(), expected, StringComparison.Ordinal))
            return BadRequest(ApiResponse<DemoSeedResult>.Fail($"Type '{expected}' to replace current business data with samples."));

        var result = await demoDataSeeder.ResetAndSeedAsync(cancellationToken);
        return Ok(ApiResponse<DemoSeedResult>.Ok(result, "Professional demo data loaded."));
    }
}
