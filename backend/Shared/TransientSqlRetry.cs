using Microsoft.Data.SqlClient;

namespace ECommerce.Shared;

public static class TransientSqlRetry
{
    private static readonly HashSet<int> TransientNumbers =
    [
        -2, 20, 64, 233, 4060, 10928, 10929, 40143, 40197, 40501,
        40613, 10053, 10054, 10060, 49918, 49919, 49920
    ];

    public static async Task<T> ExecuteAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken = default,
        int maxRetryCount = 3)
    {
        ArgumentNullException.ThrowIfNull(operation);

        for (var attempt = 0; ; attempt++)
        {
            try
            {
                return await operation(cancellationToken);
            }
            catch (Exception exception) when (
                attempt < maxRetryCount &&
                !cancellationToken.IsCancellationRequested &&
                IsTransient(exception))
            {
                var delay = TimeSpan.FromMilliseconds(
                    Math.Min(250 * Math.Pow(2, attempt), 2_000));
                await Task.Delay(delay, cancellationToken);
            }
        }
    }

    private static bool IsTransient(Exception exception)
    {
        if (exception is TimeoutException or TaskCanceledException)
            return true;

        if (exception is SqlException sqlException &&
            sqlException.Errors.Cast<SqlError>().Any(error => TransientNumbers.Contains(error.Number)))
            return true;

        return exception.InnerException is not null && IsTransient(exception.InnerException);
    }
}
