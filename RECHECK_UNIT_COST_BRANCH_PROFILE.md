# UnitCost, Branch Claim, and Profile Update Recheck

## Fixed

1. **Missing `OrderItems.UnitCost` / `InventorySaleItems.UnitCost` columns**
   - Added the missing `DbContext(typeof(ApplicationDbContext))` metadata to both hand-written migrations so EF Core discovers them.
   - Added a startup repair for databases where `20260727110000_AddCostSnapshotsForProfitReporting` is already recorded in `__EFMigrationsHistory` but either physical `UnitCost` column is missing.
   - Existing rows are backfilled from the latest valid purchase cost available at the sale/order date.

2. **Nullable branch claim compile error**
   - Changed the local variable from inferred `var` to explicit `long?`.

3. **False phone/email duplicate errors during profile update**
   - Duplicate checks now run only when the normalized email or phone value actually changes.
   - Saving an unchanged profile no longer reports that its own phone number already exists.
   - A genuine attempt to change to another account's phone/email is still rejected because phone/email login must remain unambiguous.

## Run after replacing the project

Restart the API. `Program.cs` calls `InitializeDatabaseAsync()`, which applies pending migrations before serving requests.

You can also apply migrations manually:

```bash
cd backend
dotnet ef database update
```

Recommended verification in SQL Server:

```sql
SELECT COL_LENGTH('dbo.OrderItems', 'UnitCost') AS OrderItemUnitCost;
SELECT COL_LENGTH('dbo.InventorySaleItems', 'UnitCost') AS InventorySaleItemUnitCost;

SELECT MigrationId
FROM dbo.__EFMigrationsHistory
WHERE MigrationId IN
(
    '20260727110000_AddCostSnapshotsForProfitReporting',
    '20260727113000_ConvertToSingleCompanyPermissions'
);
```
