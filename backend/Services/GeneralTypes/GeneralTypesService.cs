namespace ECommerce.Services.GeneralTypes;

using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Dtos;
using ECommerce.Entities.Common;
using Microsoft.EntityFrameworkCore;

public class GeneralTypesService : IGeneralTypeService
{
    private readonly ApplicationDbContext _context;


    public GeneralTypesService(
        ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<GeneralTypeDto>> GetAsync(string? group)
    {
        var query = _context.Types
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(group) &&
            Enum.TryParse<GeneralTypeEnum>(group, true, out var parsedGroup))
        {
            query = query.Where(x => x.Group == parsedGroup);
        }

        return await query
            .OrderBy(x => x.Group)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Select(x => new GeneralTypeDto
            {
                Id = x.Id,
                Name = x.Name,
                Group = x.Group.ToString(),
                ParentId = x.ParentId,
                ParentName = x.Parent != null ? x.Parent.Name : null,
                SortOrder = x.SortOrder ?? 0
            })
            .ToListAsync();
    }

    public async Task<GeneralType?> GetByIdAsync(
        long id)
    {
        return await _context.Types
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<long> CreateAsync(
        GeneralType model)
    {
        model.Name = model.Name.Trim();
        await ValidateParentAsync(model.ParentId, model.Group);
        var exists = await _context.Types
            .AnyAsync(x =>
                x.Name == model.Name &&
                x.Group == model.Group);

        if (exists)
        {
            throw new InvalidOperationException(
                "This type already exists.");
        }


        _context.Types.Add(model);

        await _context.SaveChangesAsync();


        return model.Id;
    }

    public async Task UpdateAsync(
        long id,
        GeneralType model)
    {
        model.Name = model.Name.Trim();
        var entity = await _context.Types
            .FirstOrDefaultAsync(x => x.Id == id);


        if (entity == null)
        {
            throw new KeyNotFoundException(
                "Type not found.");
        }

        if (model.ParentId == id)
            throw new InvalidOperationException("A type cannot be its own parent.");

        await ValidateParentAsync(model.ParentId, model.Group);

        if (model.ParentId.HasValue && await IsDescendantAsync(id, model.ParentId.Value))
            throw new InvalidOperationException("A child type cannot be selected as the parent.");


        var exists = await _context.Types
            .AnyAsync(x =>
                x.Id != id &&
                x.Name == model.Name &&
                x.Group == model.Group);



        if (exists)
        {
            throw new InvalidOperationException(
                "This type already exists.");
        }


        entity.Name = model.Name;
        entity.Group = model.Group;
        entity.ParentId = model.ParentId;

        await _context.SaveChangesAsync();
    }

    private async Task ValidateParentAsync(long? parentId, GeneralTypeEnum group)
    {
        if (!parentId.HasValue) return;
        var valid = await _context.Types.AnyAsync(x => x.Id == parentId.Value && x.Group == group);
        if (!valid) throw new InvalidOperationException("The selected parent must belong to the same group.");
    }

    private async Task<bool> IsDescendantAsync(long id, long candidateParentId)
    {
        var currentId = (long?)candidateParentId;
        var visited = new HashSet<long>();
        while (currentId.HasValue && visited.Add(currentId.Value))
        {
            if (currentId.Value == id) return true;
            currentId = await _context.Types.Where(x => x.Id == currentId.Value).Select(x => x.ParentId).FirstOrDefaultAsync();
        }
        return false;
    }

    public async Task DeleteAsync(
        long id)
    {
        var entity = await _context.Types
            .FirstOrDefaultAsync(x => x.Id == id);


        if (entity == null)
        {
            throw new KeyNotFoundException(
                "Type not found.");
        }


        var hasChildren = await _context.Types
            .AnyAsync(x => x.ParentId == id);


        if (hasChildren)
        {
            throw new InvalidOperationException(
                "Cannot delete type with children.");
        }



        _context.Types.Remove(entity);


        await _context.SaveChangesAsync();
    }
}
