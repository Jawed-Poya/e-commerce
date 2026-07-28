# Database and Large-PDF Performance Test

This kit inserts deterministic development data, executes the main reporting queries with SQL Server statistics enabled, calls the API query benchmark, and generates a large product PDF through QuestPDF.

## Safety

Run this only against a disposable local or staging database. Back up the database first.

All generated business keys begin with `PERF-LOAD-`. Cleanup deletes only those records. The scripts use hard deletes because this is disposable performance data.

## What the standard profile creates

- 10,000 products
- 20,000 customers
- 50,000 delivered and paid orders
- 4 items per order, producing 200,000 order items
- 50,000 payment records
- A mixture of physical-stock and display-stock products
- Dates distributed across approximately one year

The safety limits are 100,000 products, 250,000 customers, 500,000 orders, and 20 items per order.

## Before running

Apply the latest migration, which adds report-oriented indexes:

```powershell
cd backend
dotnet ef database update
```

Start the API in Development mode. The query benchmark endpoint intentionally returns `404` outside Development:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --launch-profile http
```

Install Microsoft `sqlcmd` if it is not already available.

## One-command standard test

Run from the repository root:

```powershell
./scripts/run-performance-test.ps1 `
  -Server "localhost" `
  -Database "Ecommerce" `
  -ApiBaseUrl "http://localhost:5000" `
  -Identifier "admin@example.com" `
  -Password "your-password"
```

For a named SQL Server instance:

```powershell
./scripts/run-performance-test.ps1 `
  -Server "JAWED-POYA\JPK" `
  -Database "Ecommerce" `
  -ApiBaseUrl "http://localhost:5000" `
  -Identifier "admin@example.com" `
  -Password "your-password"
```

The runner can also accept an existing JWT:

```powershell
./scripts/run-performance-test.ps1 -Token "your-access-token"
```

## Larger stress profile

```powershell
./scripts/run-performance-test.ps1 `
  -Server "JAWED-POYA\JPK" `
  -Database "Ecommerce" `
  -ProductCount 25000 `
  -CustomerCount 50000 `
  -OrderCount 150000 `
  -ItemsPerOrder 5 `
  -PdfRows 25000 `
  -ApiBaseUrl "http://localhost:5000" `
  -Identifier "admin@example.com" `
  -Password "your-password"
```

Start with the standard profile. Large SQL transaction logs and PDF memory usage depend on the machine and SQL Server configuration.

## Test output

Each run creates a timestamped folder under `performance-results/` containing:

- Configured seed SQL
- Seed timings and inserted row counts
- SQL Server `STATISTICS IO` and `STATISTICS TIME` output
- API benchmark JSON
- Generated PDF
- PDF server-generation and full round-trip timings
- PDF byte size
- A combined `summary.json`

The product PDF endpoint accepts:

```text
GET /api/admin/documents/products/pdf?maxRows=10000
```

`maxRows` is clamped between 1 and 50,000. The response includes:

```text
X-Document-Generation-Ms
X-Document-Bytes
X-Document-Max-Rows
```

The Development-only query endpoint is:

```text
GET /api/admin/performance/catalog-query?take=10000
```

It reports returned rows, database-query elapsed time, approximate managed-memory growth, stock totals, and priced-row count.

## Manual SQL-only run

The scripts can be executed separately:

```powershell
sqlcmd -S "JAWED-POYA\JPK" -d Ecommerce -E -C -b -i backend/Scripts/performance/01-seed-performance-data.sql
sqlcmd -S "JAWED-POYA\JPK" -d Ecommerce -E -C -b -i backend/Scripts/performance/02-benchmark-queries.sql
```

The SQL files use their standard default sizes. Use the PowerShell runner when custom row counts are required.

## Cleanup

Cleanup immediately after the test:

```powershell
./scripts/run-performance-test.ps1 `
  -Server "JAWED-POYA\JPK" `
  -Database "Ecommerce" `
  -Token "your-access-token" `
  -CleanupAfter
```

Or run only the cleanup SQL:

```powershell
sqlcmd -S "JAWED-POYA\JPK" -d Ecommerce -E -C -b -i backend/Scripts/performance/03-cleanup-performance-data.sql
```

## Reading the result

Compare the second and later runs, because the first run includes connection setup, JIT compilation, and cold caches. Focus on:

- Logical reads from `STATISTICS IO`
- SQL elapsed time, not only client round-trip time
- PDF server-generation time versus download round-trip time
- API managed-memory growth
- SQL table and index sizes
- Whether the performance indexes show seeks instead of only scans

Do not use `DBCC DROPCLEANBUFFERS` on a shared server. This kit intentionally avoids clearing SQL Server's global cache.
