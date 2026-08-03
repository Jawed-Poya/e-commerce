[CmdletBinding()]
param(
    [string]$Server = "localhost",
    [string]$Database = "Ecommerce",
    [int]$ProductCount = 10000,
    [int]$CustomerCount = 20000,
    [int]$OrderCount = 50000,
    [ValidateRange(1, 20)]
    [int]$ItemsPerOrder = 4,
    [ValidateRange(1, 50000)]
    [int]$PdfRows = 10000,
    [string]$ApiBaseUrl = "http://localhost:5000",
    [string]$Token,
    [string]$Identifier,
    [string]$Password,
    [string]$SqlUsername,
    [string]$SqlPassword,
    [string]$OutputDirectory,
    [switch]$SkipSeed,
    [switch]$SkipApiBenchmark,
    [switch]$SkipPdf,
    [switch]$CleanupAfter
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$sqlRoot = Join-Path $projectRoot "backend/Scripts/performance"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot "performance-results"
}

$runStamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$runDirectory = Join-Path $OutputDirectory $runStamp
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
    throw "sqlcmd was not found. Install Microsoft SQL command-line tools and run this script again."
}

function Get-SqlConnectionArguments {
    $arguments = @("-S", $Server, "-d", $Database, "-b", "-r", "1", "-C")
    if ([string]::IsNullOrWhiteSpace($SqlUsername)) {
        $arguments += "-E"
    }
    else {
        if ([string]::IsNullOrWhiteSpace($SqlPassword)) {
            throw "SqlPassword is required when SqlUsername is supplied."
        }
        $arguments += @("-U", $SqlUsername, "-P", $SqlPassword)
    }
    return $arguments
}

function Invoke-SqlScript {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$LogPath
    )

    $arguments = Get-SqlConnectionArguments
    $arguments += @("-i", $Path)

    Write-Host "Running SQL script: $Path"
    & $sqlcmd.Source @arguments 2>&1 | Tee-Object -FilePath $LogPath
    if ($LASTEXITCODE -ne 0) {
        throw "SQL script failed with exit code $LASTEXITCODE. See $LogPath"
    }
}

function New-ConfiguredSqlScript {
    param(
        [Parameter(Mandatory)] [string]$SourcePath,
        [Parameter(Mandatory)] [string]$DestinationPath
    )

    $content = Get-Content -Raw -Path $SourcePath
    $content = $content.Replace("DECLARE @ProductCount int = 10000;            -- PERF_PRODUCT_COUNT", "DECLARE @ProductCount int = $ProductCount;            -- PERF_PRODUCT_COUNT")
    $content = $content.Replace("DECLARE @CustomerCount int = 20000;           -- PERF_CUSTOMER_COUNT", "DECLARE @CustomerCount int = $CustomerCount;           -- PERF_CUSTOMER_COUNT")
    $content = $content.Replace("DECLARE @OrderCount int = 50000;              -- PERF_ORDER_COUNT", "DECLARE @OrderCount int = $OrderCount;              -- PERF_ORDER_COUNT")
    $content = $content.Replace("DECLARE @ItemsPerOrder int = 4;               -- PERF_ITEMS_PER_ORDER", "DECLARE @ItemsPerOrder int = $ItemsPerOrder;               -- PERF_ITEMS_PER_ORDER")
    $content = $content.Replace("DECLARE @CatalogRows int = 10000;   -- PERF_CATALOG_ROWS", "DECLARE @CatalogRows int = $PdfRows;   -- PERF_CATALOG_ROWS")
    Set-Content -Path $DestinationPath -Value $content -Encoding UTF8
}

function Resolve-AccessToken {
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        return $Token
    }

    if ([string]::IsNullOrWhiteSpace($Identifier) -or [string]::IsNullOrWhiteSpace($Password)) {
        throw "Supply either -Token or both -Identifier and -Password for API/PDF tests."
    }

    $loginBody = @{
        identifier = $Identifier
        password = $Password
    } | ConvertTo-Json

    $loginArguments = @{
        Method = "Post"
        Uri = "$($ApiBaseUrl.TrimEnd('/'))/api/auth/admin/login"
        ContentType = "application/json"
        Body = $loginBody
        TimeoutSec = 120
    }
    $login = Invoke-RestMethod @loginArguments

    if (-not $login.success -or [string]::IsNullOrWhiteSpace($login.data.token)) {
        throw "Admin login did not return an access token."
    }

    return [string]$login.data.token
}

$summary = [ordered]@{
    runId = $runStamp
    server = $Server
    database = $Database
    productCount = $ProductCount
    customerCount = $CustomerCount
    orderCount = $OrderCount
    itemsPerOrder = $ItemsPerOrder
    requestedPdfRows = $PdfRows
    startedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}

try {
    if (-not $SkipSeed) {
        $seedScript = Join-Path $runDirectory "01-seed-configured.sql"
        New-ConfiguredSqlScript `
            -SourcePath (Join-Path $sqlRoot "01-seed-performance-data.sql") `
            -DestinationPath $seedScript

        $seedStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        Invoke-SqlScript -Path $seedScript -LogPath (Join-Path $runDirectory "01-seed.log")
        $seedStopwatch.Stop()
        $summary["seedElapsedMilliseconds"] = $seedStopwatch.ElapsedMilliseconds
    }

    $benchmarkScript = Join-Path $runDirectory "02-benchmark-configured.sql"
    New-ConfiguredSqlScript `
        -SourcePath (Join-Path $sqlRoot "02-benchmark-queries.sql") `
        -DestinationPath $benchmarkScript

    $queryStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-SqlScript -Path $benchmarkScript -LogPath (Join-Path $runDirectory "02-benchmark.log")
    $queryStopwatch.Stop()
    $summary["sqlBenchmarkElapsedMilliseconds"] = $queryStopwatch.ElapsedMilliseconds

    if (-not $SkipApiBenchmark -or -not $SkipPdf) {
        $accessToken = Resolve-AccessToken
        $headers = @{ Authorization = "Bearer $accessToken" }

        if (-not $SkipApiBenchmark) {
            $apiStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $apiArguments = @{
                Method = "Get"
                Uri = "$($ApiBaseUrl.TrimEnd('/'))/api/admin/performance/catalog-query?take=$PdfRows"
                Headers = $headers
                TimeoutSec = 600
            }
            $apiResult = Invoke-RestMethod @apiArguments
            $apiStopwatch.Stop()

            $summary["apiBenchmarkRoundTripMilliseconds"] = $apiStopwatch.ElapsedMilliseconds
            $summary["apiBenchmark"] = $apiResult
            $apiResult | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $runDirectory "03-api-benchmark.json") -Encoding UTF8
        }

        if (-not $SkipPdf) {
            $pdfPath = Join-Path $runDirectory "products-$PdfRows-rows.pdf"
            $pdfStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $pdfArguments = @{
                Method = "Get"
                Uri = "$($ApiBaseUrl.TrimEnd('/'))/api/admin/documents/products/pdf?maxRows=$PdfRows"
                Headers = $headers
                OutFile = $pdfPath
                TimeoutSec = 900
            }
            $pdfResponse = Invoke-WebRequest @pdfArguments
            $pdfStopwatch.Stop()

            $pdfFile = Get-Item $pdfPath
            $summary["pdfPath"] = $pdfFile.FullName
            $summary["pdfBytes"] = $pdfFile.Length
            $summary["pdfRoundTripMilliseconds"] = $pdfStopwatch.ElapsedMilliseconds
            $summary["pdfServerGenerationMilliseconds"] = [long]($pdfResponse.Headers["X-Document-Generation-Ms"] | Select-Object -First 1)
            $summary["pdfServerReportedBytes"] = [long]($pdfResponse.Headers["X-Document-Bytes"] | Select-Object -First 1)
        }
    }
}
finally {
    if ($CleanupAfter) {
        $cleanupScript = Join-Path $runDirectory "03-cleanup-configured.sql"
        New-ConfiguredSqlScript `
            -SourcePath (Join-Path $sqlRoot "03-cleanup-performance-data.sql") `
            -DestinationPath $cleanupScript
        Invoke-SqlScript -Path $cleanupScript -LogPath (Join-Path $runDirectory "04-cleanup.log")
        $summary["cleanedUp"] = $true
    }

    $summary["completedAtUtc"] = (Get-Date).ToUniversalTime().ToString("o")
    $summary | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $runDirectory "summary.json") -Encoding UTF8
}

Write-Host ""
Write-Host "Performance run completed."
Write-Host "Results: $runDirectory"
$summary | Format-List
