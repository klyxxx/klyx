$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-41-controlled-history-repair.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-history-repair-13-41.json"

Write-Host ""
Write-Host "KLYX 13.41d final remote history verification..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.41d runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.ParserSupportsBackticks -ne
    $true
) {
    throw "13.41d : parser backticks invalide."
}

if (
    $data.RemoteHistoryCanonical -ne
    $true
) {
    throw "13.41d : historique distant non canonique."
}

if (
    [int]$data.RemoteMigrationCount -ne
    1
) {
    throw "13.41d : remote migration count != 1."
}

if (
    [string]$data.CanonicalBaselineVersion -ne
    "20260814000000"
) {
    throw "13.41d : mauvaise baseline canonique."
}

if (
    $data.ProductionSchemaUnchanged -ne
    $true
) {
    throw "13.41d : schema production modifie."
}

if (
    $data.ApplicationDataModified -ne
    $false
) {
    throw "13.41d : donnees applicatives modifiees."
}

if (
    $data.MigrationRepairExecutedThisRun -ne
    $false
) {
    throw "13.41d : migration repair inattendu."
}

if (
    $data.LinkedWriteUsedThisRun -ne
    $false
) {
    throw "13.41d : linked write inattendu."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.41d tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.41d TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.41d build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.41 CHECK OK"
Write-Host "======================================"
Write-Host "Remote migration history : CANONICAL"
Write-Host "Canonical baseline remote : 20260814000000"
Write-Host "Remote migration count : 1"
Write-Host "Production public schema : UNCHANGED"
Write-Host "Application data : UNCHANGED"
Write-Host "migration repair this run : NON"
Write-Host "Production linked writes this run : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"