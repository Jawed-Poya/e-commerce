using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace ECommerce.Shared;

/// <summary>
/// Prevents ordinary MVC action CancellationToken parameters from inheriting
/// the browser disconnect token. A cancelled Axios request must not interrupt a
/// database transaction or surface TaskCanceledException from EF Core.
/// Streaming endpoints that need disconnect awareness use RequestAborted explicitly.
/// </summary>
public sealed class StableCancellationTokenModelBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        ArgumentNullException.ThrowIfNull(bindingContext);
        bindingContext.Result = ModelBindingResult.Success(CancellationToken.None);
        return Task.CompletedTask;
    }
}

public sealed class StableCancellationTokenModelBinderProvider : IModelBinderProvider
{
    private static readonly IModelBinder Binder = new StableCancellationTokenModelBinder();

    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.Metadata.ModelType == typeof(CancellationToken) ? Binder : null;
    }
}
