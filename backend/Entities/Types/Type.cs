using API.Entities.Common;
using ECommerce.Entities.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Entities.Types;

public class GeneralType : BaseEntity
{
    public string Name { get; set; } = null!;

    [MaxLength(2048)]
    public string? ImageUrl { get; set; }
    
    public GeneralTypeEnum Group { get; set; } = GeneralTypeEnum.None;

    public int? SortOrder { get; set; }

    public long? ParentId { get; set; }

    public GeneralType? Parent { get; set; }

    public ICollection<GeneralType> Children { get; set; } = [];
}
