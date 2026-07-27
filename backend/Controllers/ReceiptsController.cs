using ECommerce.Entities;
using ECommerce.Services.Documents;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/receipts")]
[Authorize]
public sealed class ReceiptsController(IFinancialDocumentService documents) : ControllerBase
{
    [HttpGet("{source}/{id:long}/pdf")]
    public async Task<IActionResult> Pdf(
        string source,
        long id,
        [FromQuery] bool thermal = false,
        CancellationToken cancellationToken = default)
    {
        if (!CanViewSource(source)) return Forbid();

        try
        {
            var receipt = await documents.GetReceiptAsync(source, id, cancellationToken);
            return File(
                documents.CreateReceiptPdf(receipt, thermal),
                "application/pdf",
                $"receipt-{SafeFileName(receipt.Reference)}.pdf");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("{source}/{id:long}/image")]
    public async Task<IActionResult> Image(
        string source,
        long id,
        [FromQuery] bool thermal = false,
        CancellationToken cancellationToken = default)
    {
        if (!CanViewSource(source)) return Forbid();

        try
        {
            var receipt = await documents.GetReceiptAsync(source, id, cancellationToken);
            return File(
                documents.CreateReceiptImage(receipt, thermal),
                "image/png",
                $"receipt-{SafeFileName(receipt.Reference)}.png");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    private bool CanViewSource(string source)
    {
        var permission = source.Trim().ToLowerInvariant() switch
        {
            "orders" => AppPermissions.OrdersView,
            "manual-sales" => AppPermissions.ManualSalesView,
            _ => null
        };

        return permission is not null &&
            (User.IsInRole(AppRoles.Admin) || User.HasClaim(AuthClaims.Permission, permission));
    }

    private static string SafeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(value.Where(character => !invalid.Contains(character)).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "sale" : cleaned;
    }
}
