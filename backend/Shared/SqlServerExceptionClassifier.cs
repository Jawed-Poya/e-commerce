using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Shared;

public static class SqlServerExceptionClassifier
{
    private const int DuplicateKey = 2601;
    private const int UniqueConstraint = 2627;

    public static bool IsUniqueConstraintViolation(
        DbUpdateException exception,
        string? indexName = null)
    {
        if (exception.InnerException is not SqlException sqlException ||
            sqlException.Number is not (DuplicateKey or UniqueConstraint))
            return false;

        return string.IsNullOrWhiteSpace(indexName) ||
               sqlException.Message.Contains(indexName, StringComparison.OrdinalIgnoreCase);
    }
}
