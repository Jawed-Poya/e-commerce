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
            message,
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
            message,
            default,
            errors
        );
    }
}
