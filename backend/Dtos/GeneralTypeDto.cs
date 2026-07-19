namespace ECommerce.Dtos;

public class GeneralTypeDto
{
    public long Id { get; set; }

    public string Name { get; set; } = null!;

    public string? ImageUrl { get; set; }

    public string Group { get; set; } = null!;

    public long? ParentId { get; set; }

    public string? ParentName { get; set; }

    public bool IsActive { get; set; }

    public int SortOrder { get; set; }
}
