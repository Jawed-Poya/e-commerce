namespace ECommerce.Services.GeneralTypes;

using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Dtos;
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

        if (!string.IsNullOrWhiteSpace(group))
        {
            query = query.Where(x => x.Group == group);
        }

        return await query
            .OrderBy(x => x.Group)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.Name)
            .Select(x => new GeneralTypeDto
            {
                Id = x.Id,
                Name = x.Name,
                Group = x.Group,
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
        var entity = await _context.Types
            .FirstOrDefaultAsync(x => x.Id == id);


        if (entity == null)
        {
            throw new KeyNotFoundException(
                "Type not found.");
        }


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
