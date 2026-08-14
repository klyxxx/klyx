$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$auditScript =
    Join-Path `
        $root `
        "scripts\run-step-13-31-audit.ps1"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-migration-audit-13-31.json"

$txtPath =
    Join-Path `
        $root `
        "reports\supabase-migration-audit-13-31.txt"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $auditScript
    )
) {
    throw "13.31 : audit script introuvable."
}

Write-Host ""
Write-Host "Running migration audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $auditScript

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.31 audit FAILED."
}

foreach (
    $path
    in @(
        $jsonPath,
        $txtPath
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.31 : rapport manquant : $path"
    }
}

$report =
    Get-Content `
        -LiteralPath `
        $jsonPath `
        -Raw |
    ConvertFrom-Json

if (
    $report.Step -ne
    "13.31"
) {
    throw "13.31 : mauvais rapport."
}

if (
    $report.Revision -ne
    "13.31a"
) {
    throw "13.31 : revision corrigee absente."
}

if (
    $report.DestructiveChangesApplied -ne
    $false
) {
    throw "13.31 : modification destructive detectee."
}

Write-Host ""
Write-Host "Audit summary..."
Write-Host ""

Write-Host (
    "SQL total                : " +
    $report.Counts.TotalSqlFiles
)

Write-Host (
    "Active migrations        : " +
    $report.Counts.ActiveMigrations
)

Write-Host (
    "Dispersed SQL            : " +
    $report.Counts.DispersedSqlFiles
)

Write-Host (
    "Legacy migration folders : " +
    $report.Counts.LegacyMigrationDirectories
)

Write-Host (
    "Duplicate timestamps     : " +
    $report.Counts.DuplicateActiveTimestamps
)

Write-Host (
    "Fresh rebuild ready      : " +
    $report.FreshRebuildReady
)

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.31 automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.31 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.31 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.31 CHECK OK"
Write-Host "======================================"
Write-Host "Supabase SQL inventory : COMPLETE"
Write-Host "Active migrations inventory : COMPLETE"
Write-Host "Legacy migrations inventory : COMPLETE"
Write-Host "Dispersed SQL detection : ACTIVE"
Write-Host "Duplicate timestamp detection : ACTIVE"
Write-Host "Critical schema coverage : AUDITED"
Write-Host "Fresh rebuild readiness : MEASURED"
Write-Host "SQL moved : NON"
Write-Host "SQL deleted : NON"
Write-Host "Production DB modified : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"