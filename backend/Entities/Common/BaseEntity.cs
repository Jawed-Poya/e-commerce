using System.ComponentModel.DataAnnotations;

namespace API.Entities.Common;

public abstract class BaseEntity
{
    [Key]
    public long Id { get; set; }

    public long? BranchId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime? DeletedAt { get; set; }
}
