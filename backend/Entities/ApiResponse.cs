namespace ECommerce.Entities;

public sealed record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data,
    IReadOnlyDictionary<string, string[]>? Errors = null
)
{
    public static ApiResponse<T> Ok(
        T data,
        string message = "Operation completed successfully."
    )
    {
        return new ApiResponse<T>(
            true,
            Normalize(message, "Operation completed successfully."),
            data
        );
    }

    public static ApiResponse<T> Fail(
        string message,
        IReadOnlyDictionary<string, string[]>? errors = null
    )
    {
        return new ApiResponse<T>(
            false,
            Normalize(message, "The request could not be completed."),
            default,
            errors
        );
    }

    private static string Normalize(string? message, string fallback) =>
        string.IsNullOrWhiteSpace(message) ? fallback : message.Trim();
}
