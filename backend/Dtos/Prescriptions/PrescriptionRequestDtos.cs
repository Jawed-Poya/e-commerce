using System.ComponentModel.DataAnnotations;
using ECommerce.Entities.Storefront;
using Microsoft.AspNetCore.Http;

namespace ECommerce.Dtos.Prescriptions;

public sealed class CreatePrescriptionRequest
{
    [Required, StringLength(160, MinimumLength = 2)]
    public string FullName { get; set; } = null!;

    [Required, StringLength(40, MinimumLength = 5)]
    public string Phone { get; set; } = null!;

    [EmailAddress, StringLength(256)]
    public string? Email { get; set; }

    [StringLength(1500)]
    public string? Notes { get; set; }

    [Required]
    public IFormFile Attachment { get; set; } = null!;
}

public sealed record PrescriptionRequestCreatedResponse(
    long Id,
    string RequestNumber,
    PrescriptionRequestStatus Status,
    DateTime CreatedAt);

public sealed record AdminPrescriptionRequestResponse(
    long Id,
    string RequestNumber,
    string FullName,
    string Phone,
    string? Email,
    string? Notes,
    string OriginalFileName,
    string ContentType,
    long FileSize,
    PrescriptionRequestStatus Status,
    string? AdminNotes,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed class UpdatePrescriptionRequestStatusRequest
{
    [Required]
    public PrescriptionRequestStatus Status { get; set; }

    [StringLength(1500)]
    public string? AdminNotes { get; set; }
}

public sealed record PagedPrescriptionRequestsResponse(
    IReadOnlyCollection<AdminPrescriptionRequestResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);
