using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using API.Entities.Common;
using ECommerce.Data;
using ECommerce.Options;
using ECommerce.Shared;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Company;

public sealed record DatabaseMaintenanceStatus(
    string DatabaseName,
    bool BackupConfigured,
    bool RestoreEnabled,
    string? BackupDirectory,
    string UploadDirectory,
    string HostPlatform);

public sealed record DatabaseBackupInfo(
    string FileName,
    string PhysicalPath,
    DateTime StartedAt,
    DateTime? FinishedAt,
    long SizeBytes,
    string BackupType);

public sealed record ClearBusinessDataResult(
    string Scope,
    long? BranchId,
    int DeletedRecords,
    IReadOnlyDictionary<string, int> DeletedByArea);

public interface IDatabaseMaintenanceService
{
    Task<DatabaseMaintenanceStatus> GetStatusAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<DatabaseBackupInfo>> GetBackupsAsync(CancellationToken cancellationToken = default);
    Task<DatabaseBackupInfo> CreateBackupAsync(CancellationToken cancellationToken = default);
    Task RestoreBackupAsync(string fileName, CancellationToken cancellationToken = default);
    Task<ClearBusinessDataResult> ClearBusinessDataAsync(long? branchId, CancellationToken cancellationToken = default);
}

public sealed class DatabaseMaintenanceService(
    ApplicationDbContext context,
    IOptions<DatabaseMaintenanceOptions> maintenanceOptions,
    IOptions<FileStorageOptions> fileStorageOptions,
    IWebHostEnvironment environment,
    IMemoryCache cache,
    ILogger<DatabaseMaintenanceService> logger) : IDatabaseMaintenanceService
{
    private static readonly Regex BackupFileNamePattern = new(
        @"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}\.bak$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly DatabaseMaintenanceOptions _options = maintenanceOptions.Value;
    private readonly FileStorageOptions _fileStorage = fileStorageOptions.Value;

    public async Task<DatabaseMaintenanceStatus> GetStatusAsync(
        CancellationToken cancellationToken = default)
    {
        var directory = await ResolveBackupDirectoryAsync(cancellationToken);
        return new DatabaseMaintenanceStatus(
            DatabaseName(),
            directory is not null,
            directory is not null && _options.RestoreEnabled,
            directory,
            _fileStorage.ResolveRootPath(environment),
            OperatingSystem.IsWindows() ? "Windows" : OperatingSystem.IsLinux() ? "Linux" : "Other");
    }

    public async Task<IReadOnlyCollection<DatabaseBackupInfo>> GetBackupsAsync(
        CancellationToken cancellationToken = default)
    {
        var directory = await RequireBackupDirectoryAsync(cancellationToken);
        await using var connection = CreateServerConnection("msdb");
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandTimeout = CommandTimeout();
        command.CommandText = """
SELECT TOP (50)
    media.physical_device_name,
    backup_set.backup_start_date,
    backup_set.backup_finish_date,
    backup_set.backup_size,
    backup_set.type
FROM msdb.dbo.backupset AS backup_set
INNER JOIN msdb.dbo.backupmediafamily AS media
    ON media.media_set_id = backup_set.media_set_id
WHERE backup_set.database_name = @database
  AND backup_set.type = 'D'
  AND media.physical_device_name LIKE @directoryPrefix
ORDER BY backup_set.backup_finish_date DESC;
""";
        command.Parameters.Add(new SqlParameter("@database", SqlDbType.NVarChar, 128) { Value = DatabaseName() });
        command.Parameters.Add(new SqlParameter("@directoryPrefix", SqlDbType.NVarChar, 4000)
        {
            Value = CombineServerPath(directory, "%")
        });

        var backups = new List<DatabaseBackupInfo>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var physicalPath = reader.GetString(0);
            backups.Add(new DatabaseBackupInfo(
                FileNameFromServerPath(physicalPath),
                physicalPath,
                reader.GetDateTime(1),
                reader.IsDBNull(2) ? null : reader.GetDateTime(2),
                Convert.ToInt64(reader.GetValue(3)),
                reader.GetString(4) == "D" ? "Full" : reader.GetString(4)));
        }

        return backups;
    }

    public async Task<DatabaseBackupInfo> CreateBackupAsync(
        CancellationToken cancellationToken = default)
    {
        var directory = await RequireBackupDirectoryAsync(cancellationToken);
        var databaseName = DatabaseName();
        var safeDatabaseName = Regex.Replace(databaseName, @"[^a-zA-Z0-9_-]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(safeDatabaseName)) safeDatabaseName = "database";
        var fileName = $"{safeDatabaseName}-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.bak";
        var physicalPath = CombineServerPath(directory, fileName);

        await using var connection = CreateServerConnection("master");
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandTimeout = CommandTimeout();
        command.CommandText = $"BACKUP DATABASE {QuoteIdentifier(databaseName)} TO DISK = @path WITH COPY_ONLY, CHECKSUM, INIT;";
        command.Parameters.Add(new SqlParameter("@path", SqlDbType.NVarChar, 4000) { Value = physicalPath });
        await command.ExecuteNonQueryAsync(cancellationToken);

        var backups = await GetBackupsAsync(cancellationToken);
        return backups.FirstOrDefault(item => string.Equals(item.FileName, fileName, StringComparison.OrdinalIgnoreCase))
            ?? new DatabaseBackupInfo(fileName, physicalPath, DateTime.UtcNow, DateTime.UtcNow, 0, "Full");
    }

    public async Task RestoreBackupAsync(
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var directory = await RequireBackupDirectoryAsync(cancellationToken);
        if (!_options.RestoreEnabled)
            throw new InvalidOperationException(
                "Database restore is disabled. Set DatabaseMaintenance:RestoreEnabled to true after verifying the backup directory and permissions.");
        if (string.IsNullOrWhiteSpace(fileName) || !BackupFileNamePattern.IsMatch(fileName.Trim()))
            throw new ArgumentException("Select a valid .bak file from the configured backup directory.");

        var normalizedFileName = fileName.Trim();
        var knownBackup = (await GetBackupsAsync(cancellationToken))
            .Any(item => string.Equals(item.FileName, normalizedFileName, StringComparison.OrdinalIgnoreCase));
        if (!knownBackup)
            throw new KeyNotFoundException("The selected backup is not registered for this database.");

        var physicalPath = CombineServerPath(directory, normalizedFileName);
        var databaseName = DatabaseName();
        SqlConnection.ClearAllPools();
        await using var connection = CreateServerConnection("master");
        await connection.OpenAsync(cancellationToken);

        await using (var verify = connection.CreateCommand())
        {
            verify.CommandTimeout = CommandTimeout();
            verify.CommandText = "RESTORE VERIFYONLY FROM DISK = @path WITH CHECKSUM;";
            verify.Parameters.Add(new SqlParameter("@path", SqlDbType.NVarChar, 4000) { Value = physicalPath });
            await verify.ExecuteNonQueryAsync(cancellationToken);
        }

        try
        {
            await using var restore = connection.CreateCommand();
            restore.CommandTimeout = CommandTimeout();
            restore.CommandText = $"""
ALTER DATABASE {QuoteIdentifier(databaseName)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE {QuoteIdentifier(databaseName)} FROM DISK = @path WITH REPLACE, RECOVERY;
ALTER DATABASE {QuoteIdentifier(databaseName)} SET MULTI_USER;
""";
            restore.Parameters.Add(new SqlParameter("@path", SqlDbType.NVarChar, 4000) { Value = physicalPath });
            await restore.ExecuteNonQueryAsync(cancellationToken);
            logger.LogWarning("Database {DatabaseName} was restored from {BackupFileName}.", databaseName, normalizedFileName);
        }
        catch
        {
            try
            {
                await using var recover = connection.CreateCommand();
                recover.CommandTimeout = 60;
                recover.CommandText = $"ALTER DATABASE {QuoteIdentifier(databaseName)} SET MULTI_USER WITH ROLLBACK IMMEDIATE;";
                await recover.ExecuteNonQueryAsync(CancellationToken.None);
            }
            catch (Exception recoveryException)
            {
                logger.LogCritical(recoveryException, "Could not return database {DatabaseName} to multi-user mode after a failed restore.", databaseName);
            }

            throw;
        }
        finally
        {
            SqlConnection.ClearAllPools();
        }
    }

    public async Task<ClearBusinessDataResult> ClearBusinessDataAsync(
        long? branchId,
        CancellationToken cancellationToken = default)
    {
        if (branchId.HasValue && !await context.Branches.AnyAsync(item => item.Id == branchId.Value, cancellationToken))
            throw new KeyNotFoundException("The selected branch was not found.");

        context.ChangeTracker.Clear();
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        async Task DeleteAsync<TEntity>(string area, DbSet<TEntity> set)
            where TEntity : BaseEntity
        {
            IQueryable<TEntity> query = set.IgnoreQueryFilters();
            if (branchId.HasValue)
                query = query.Where(item => item.BranchId == branchId.Value);
            var count = await query.ExecuteDeleteAsync(cancellationToken);
            if (count > 0) counts[area] = counts.GetValueOrDefault(area) + count;
        }

        var clearedCustomerLinks = await ClearCustomerAccountLinksAsync(branchId, cancellationToken);
        if (clearedCustomerLinks > 0)
            counts["customer account links"] = clearedCustomerLinks;

        // Dependents are deleted before their parents. ExecuteDelete intentionally
        // bypasses normal trash creation because this is an explicitly confirmed
        // maintenance operation with its own permission and audit boundary.
        var clearedAccounting = await ClearJournalVoucherDataAsync(branchId, cancellationToken);
        if (clearedAccounting > 0)
            counts["accounting"] = clearedAccounting;

        await DeleteAsync("order history", context.OrderStatusHistories);
        await DeleteAsync("order history", context.Payments);
        await DeleteAsync("orders", context.OrderItems);
        await DeleteAsync("orders", context.Orders);

        await DeleteAsync("purchases", context.PurchasePayments);
        await DeleteAsync("purchases", context.PurchaseItems);
        await DeleteAsync("purchases", context.Purchases);

        await DeleteAsync("manual sales", context.InventorySalePayments);
        await DeleteAsync("manual sales", context.InventorySaleItems);
        await DeleteAsync("manual sales", context.InventorySales);

        await DeleteAsync("payroll", context.StaffSalaryInstallments);
        await DeleteAsync("payroll", context.StaffSalaryPayments);
        await DeleteAsync("staff", context.StaffMembers);
        await DeleteAsync("expenses", context.Expenses);

        await DeleteAsync("inventory", context.InventoryTransactionLots);
        await DeleteAsync("inventory", context.InventoryTransactions);
        await DeleteAsync("inventory", context.InventoryLots);
        await DeleteAsync("catalog", context.ProductReviews);
        await DeleteAsync("catalog", context.ProductPrices);
        await DeleteAsync("catalog", context.ProductUnitConversions);
        await DeleteAsync("catalog", context.ProductVariants);
        await DeleteAsync("catalog", context.ProductImages);
        await DeleteAsync("inventory", context.ProductInventories);
        await DeleteAsync("catalog", context.Products);

        // ActivityLogs has a restrictive customer foreign key and older audit
        // rows may not carry BranchId. Delete by both branch and customer link
        // immediately before the customer records so branch resets remain safe.
        var clearedAudit = await ClearCustomerAuditDataAsync(branchId, cancellationToken);
        if (clearedAudit > 0)
            counts["audit"] = clearedAudit;

        await DeleteAsync("customers", context.CustomerCarts);
        await DeleteAsync("customers", context.CustomerAddresses);
        await DeleteAsync("customers", context.Customers);
        await DeleteAsync("suppliers", context.Suppliers);
        await DeleteAsync("storefront", context.StorefrontContents);
        await DeleteAsync("notifications", context.Notifications);
        await DeleteAsync("trash", context.TrashRecords);

        await transaction.CommitAsync(cancellationToken);
        context.ChangeTracker.Clear();
        cache.Remove("storefront:content");
        cache.Remove("commerce:default-customer-type");
        var total = counts.Values.Sum();
        logger.LogWarning(
            "Cleared {RecordCount} business records for maintenance scope {Scope} ({BranchId}).",
            total,
            branchId.HasValue ? "branch" : "all",
            branchId);
        return new ClearBusinessDataResult(
            branchId.HasValue ? "branch" : "all",
            branchId,
            total,
            counts);
    }

    private async Task<int> ClearJournalVoucherDataAsync(
        long? branchId,
        CancellationToken cancellationToken)
    {
        var vouchers = context.JournalVouchers.IgnoreQueryFilters().AsQueryable();
        var lines = context.JournalVoucherLines.IgnoreQueryFilters().AsQueryable();
        if (branchId.HasValue)
        {
            var scopedVoucherIds = vouchers
                .Where(item => item.BranchId == branchId.Value)
                .Select(item => item.Id);
            lines = lines.Where(item =>
                item.BranchId == branchId.Value || scopedVoucherIds.Contains(item.JournalVoucherId));
            vouchers = vouchers.Where(item => item.BranchId == branchId.Value);
        }

        var deleted = await lines.ExecuteDeleteAsync(cancellationToken);

        // ReversalOfVoucherId is a restrictive self-reference. It has no value
        // once every voucher in the selected maintenance scope is being removed.
        await vouchers
            .Where(item => item.ReversalOfVoucherId != null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(item => item.ReversalOfVoucherId, (long?)null),
                cancellationToken);
        deleted += await vouchers.ExecuteDeleteAsync(cancellationToken);
        return deleted;
    }

    private async Task<int> ClearCustomerAuditDataAsync(
        long? branchId,
        CancellationToken cancellationToken)
    {
        var activityLogs = context.ActivityLogs.IgnoreQueryFilters().AsQueryable();
        var visitLogs = context.CustomerVisitLogs.IgnoreQueryFilters().AsQueryable();

        if (branchId.HasValue)
        {
            var customerIds = context.Customers.IgnoreQueryFilters()
                .Where(item => item.BranchId == branchId.Value)
                .Select(item => item.Id);
            activityLogs = activityLogs.Where(item =>
                item.BranchId == branchId.Value ||
                (item.CustomerId.HasValue && customerIds.Contains(item.CustomerId.Value)));
            visitLogs = visitLogs.Where(item =>
                item.BranchId == branchId.Value ||
                (item.CustomerId.HasValue && customerIds.Contains(item.CustomerId.Value)));
        }

        var deleted = await visitLogs.ExecuteDeleteAsync(cancellationToken);
        deleted += await activityLogs.ExecuteDeleteAsync(cancellationToken);
        return deleted;
    }

    private string DatabaseName()
    {
        var name = context.Database.GetDbConnection().Database;
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("The configured SQL Server database name is missing.");
        return name;
    }

    private async Task<int> ClearCustomerAccountLinksAsync(
        long? branchId,
        CancellationToken cancellationToken)
    {
        if (!branchId.HasValue)
        {
            return await context.UserClaims
                .Where(item =>
                    item.ClaimType == AuthClaims.CustomerId ||
                    item.ClaimType == AuthClaims.CustomerTypeId)
                .ExecuteDeleteAsync(cancellationToken);
        }

        var removed = 0;
        var lastCustomerId = 0L;
        while (true)
        {
            var customerIds = await context.Customers.IgnoreQueryFilters()
                .Where(item => item.BranchId == branchId.Value && item.Id > lastCustomerId)
                .OrderBy(item => item.Id)
                .Select(item => item.Id)
                .Take(500)
                .ToArrayAsync(cancellationToken);
            if (customerIds.Length == 0)
                break;

            lastCustomerId = customerIds[^1];
            var claimValues = customerIds
                .Select(item => item.ToString(CultureInfo.InvariantCulture))
                .ToArray();
            var userIds = await context.UserClaims
                .Where(item =>
                    item.ClaimType == AuthClaims.CustomerId &&
                    item.ClaimValue != null &&
                    claimValues.Contains(item.ClaimValue))
                .Select(item => item.UserId)
                .Distinct()
                .ToArrayAsync(cancellationToken);
            if (userIds.Length == 0)
                continue;

            removed += await context.UserClaims
                .Where(item =>
                    userIds.Contains(item.UserId) &&
                    (item.ClaimType == AuthClaims.CustomerId ||
                     item.ClaimType == AuthClaims.CustomerTypeId))
                .ExecuteDeleteAsync(cancellationToken);
        }

        return removed;
    }

    private SqlConnection CreateServerConnection(string database)
    {
        var connectionString = context.Database.GetConnectionString()
            ?? throw new InvalidOperationException("The SQL Server connection string is missing.");
        var builder = new SqlConnectionStringBuilder(connectionString)
        {
            InitialCatalog = database
        };
        return new SqlConnection(builder.ConnectionString);
    }

    private async Task<string> RequireBackupDirectoryAsync(CancellationToken cancellationToken) =>
        await ResolveBackupDirectoryAsync(cancellationToken)
        ?? throw new InvalidOperationException(
            "Database backup is not configured. Set DatabaseMaintenance:BackupDirectory to 'auto' or to an absolute directory on the SQL Server machine.");

    private async Task<string?> ResolveBackupDirectoryAsync(CancellationToken cancellationToken)
    {
        var configured = CleanDirectory(_options.BackupDirectory);
        if (configured is not null && !IsAutomaticBackupDirectory(configured) && IsServerAbsolutePath(configured))
            return configured;

        await using var connection = CreateServerConnection("master");
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandTimeout = Math.Min(CommandTimeout(), 60);
        command.CommandText = "SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000));";
        var serverDefault = CleanDirectory(Convert.ToString(await command.ExecuteScalarAsync(cancellationToken), CultureInfo.InvariantCulture));
        if (serverDefault is null)
        {
            if (configured is not null && !IsAutomaticBackupDirectory(configured))
            {
                throw new InvalidOperationException(
                    $"DatabaseMaintenance:BackupDirectory '{configured}' is relative and SQL Server did not report its default backup directory. Configure an absolute path that exists on the SQL Server host.");
            }

            return null;
        }

        if (configured is not null && !IsAutomaticBackupDirectory(configured) && !IsServerAbsolutePath(configured))
        {
            logger.LogWarning(
                "DatabaseMaintenance:BackupDirectory '{ConfiguredDirectory}' is relative. SQL Server resolves relative backup paths under its default backup folder and does not create missing subdirectories. Using SQL Server default backup directory '{BackupDirectory}' instead.",
                configured,
                serverDefault);
        }

        return serverDefault;
    }

    private static bool IsAutomaticBackupDirectory(string value) =>
        string.Equals(value, "auto", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "default", StringComparison.OrdinalIgnoreCase);

    private static bool IsServerAbsolutePath(string value) =>
        value.StartsWith("/", StringComparison.Ordinal) ||
        value.StartsWith("\\", StringComparison.Ordinal) ||
        Regex.IsMatch(value, @"^[a-zA-Z]:[\\/]", RegexOptions.CultureInvariant);

    private int CommandTimeout() => Math.Clamp(_options.CommandTimeoutSeconds, 30, 3600);

    private static string? CleanDirectory(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var directory = value.Trim();
        if (directory is "/" or "\\" ||
            Regex.IsMatch(directory, @"^[a-zA-Z]:[\\/]$", RegexOptions.CultureInvariant))
            return directory;
        return directory.TrimEnd('/', '\\');
    }

    private static string CombineServerPath(string directory, string fileName)
    {
        var separator = directory.Contains('\\') && !directory.Contains('/') ? '\\' : '/';
        return directory.TrimEnd('/', '\\') + separator + fileName;
    }

    private static string FileNameFromServerPath(string path)
    {
        var index = Math.Max(path.LastIndexOf('/'), path.LastIndexOf('\\'));
        return index >= 0 ? path[(index + 1)..] : path;
    }

    private static string QuoteIdentifier(string value) => $"[{value.Replace("]", "]]", StringComparison.Ordinal)}]";
}
