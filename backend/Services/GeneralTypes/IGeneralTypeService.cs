using API.Entities.Types;
using ECommerce.Dtos;

namespace ECommerce.Services.GeneralTypes;

public interface IGeneralTypeService
{
    Task<List<GeneralTypeDto>> GetAsync(string? group);

    Task<GeneralType?> GetByIdAsync(long id);

    Task<long> CreateAsync(GeneralType model);

    Task UpdateAsync(long id, GeneralType model);

    Task DeleteAsync(long id);
}
