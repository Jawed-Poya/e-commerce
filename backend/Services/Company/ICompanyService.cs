using ECommerce.Dtos.Company;

namespace ECommerce.Services.Company;

public interface ICompanyService
{
    Task<PublicCompanyProfileResponse> GetPublicProfileAsync(CancellationToken cancellationToken = default);
    Task<CompanyProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default);
    Task<CompanyProfileResponse> UpdateProfileAsync(UpdateCompanyProfileRequest request, CancellationToken cancellationToken = default);
    Task<CompanyProfileResponse> UpdateSettingsAsync(UpdateCompanySettingsRequest request, CancellationToken cancellationToken = default);
    Task<CompanyProfileResponse> UpdateOperationLimitsAsync(UpdateOperationLimitsRequest request, CancellationToken cancellationToken = default);
    Task<CompanyBranchResponse> CreateBranchAsync(UpsertCompanyBranchRequest request, CancellationToken cancellationToken = default);
    Task<CompanyBranchResponse> UpdateBranchAsync(long id, UpsertCompanyBranchRequest request, CancellationToken cancellationToken = default);
}
