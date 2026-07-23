namespace ECommerce.Entities.Products.Exceptions;

public sealed class ProductValidationException : Exception
{
    public ProductValidationException(
        IReadOnlyDictionary<string, string[]> errors
    ) : base("One or more product validation errors occurred.")
    {
        Errors = errors;
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}

public sealed class ProductConflictException : Exception
{
    public ProductConflictException(string message)
        : base(message)
    {
    }

    public ProductConflictException(
        string message,
        Exception innerException
    ) : base(message, innerException)
    {
    }
}