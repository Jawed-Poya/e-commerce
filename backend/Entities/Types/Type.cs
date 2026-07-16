using API.Entities.Common;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Entities.Types;

public class GeneralType : BaseEntity
{
    public string Name { get; set; } = null!;
    
    public string Group { get; set; } = null!;

    public int? SortOrder { get; set; }

    public long? ParentId { get; set; }

    public GeneralType? Parent { get; set; }

    public ICollection<GeneralType> Children { get; set; } = [];
}
