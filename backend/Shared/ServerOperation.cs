namespace ECommerce.Shared;

/// <summary>
/// Creates a server-owned token scope for database writes, report generation,
/// and other operations whose result must not be invalidated when the browser
/// navigates away or replaces an HTTP request.
///
/// The token intentionally is not tied to HttpContext.RequestAborted and has no
/// timer-based cancellation. SQL Server commands remain bounded by the EF Core
/// command timeout, while document rendering is allowed to finish cleanly.
/// </summary>
public static class ServerOperation
{
    public static CancellationTokenSource CreateReadScope() => new();
    public static CancellationTokenSource CreateWriteScope() => new();
    public static CancellationTokenSource CreateDocumentScope() => new();
}
