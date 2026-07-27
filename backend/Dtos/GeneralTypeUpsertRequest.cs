namespace ECommerce.Dtos;

using ECommerce.Entities.Common;
using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

public sealed class GeneralTypeUpsertRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = null!;

    [MaxLength(2048)]
    public string? ImageUrl { get; set; }

    public IFormFile? Image { get; set; }

    public GeneralTypeEnum Group { get; set; }

    public int? SortOrder { get; set; }

    public long? ParentId { get; set; }
}
