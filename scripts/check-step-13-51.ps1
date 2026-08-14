$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-51-final-repository-integrity-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-final-integrity-13-51.json"

Write-Host ""
Write-Host "KLYX 13.51 final repository integrity audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.51 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.RepositoryIntegrityAuditComplete -ne
    $true
) {
    throw "13.51 : audit incomplet."
}

if (
    [int]$data.OfficialMigrationCount -ne
    1
) {
    throw "13.51 : migration locale non canonique."
}

if (
    [int]$data.RemoteMigrationCount -ne
    1
) {
    throw "13.51 : migration distante non canonique."
}

if (
    $data.LocalRemoteMigrationAligned -ne
    $true
) {
    throw "13.51 : historique local/remote non aligne."
}

if (
    [int]$data.MigrationSkipWarnings -ne
    0
) {
    throw "13.51 : warnings migrations encore presents."
}

if (
    [int]$data.ActiveBackupArtifactCount -ne
    0
) {
    throw (
        "13.51 : backups actifs encore presents : " +
        $data.ActiveBackupArtifactCount
    )
}

if (
    $data.Archive13_45Exists -ne
    $true
) {
    throw "13.51 : archive 13.45 absente."
}

if (
    $data.Archive13_47Exists -ne
    $true
) {
    throw "13.51 : archive 13.47 absente."
}

if (
    $data.Archive13_50Exists -ne
    $true
) {
    throw "13.51 : archive 13.50 absente."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.51 : linked write interdit."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.51 : production DB modifiee."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.51 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.51 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.51 build FAILED."
}

Write-Host ""
Write-Host "Final Git status..."
Write-Host ""

git status --short

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.51 : git status FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.51 CHECK OK"
Write-Host "======================================"
Write-Host "Canonical migration : VERIFIED"
Write-Host "Local migration history : CANONICAL"
Write-Host "Remote migration history : CANONICAL"
Write-Host "Local/remote history : ALIGNED"
Write-Host "Migration warnings : 0"
Write-Host "Active backup artifacts : 0"
Write-Host "Historical archives : PRESERVED"
Write-Host "Production linked writes : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "Repository hygiene project : COMPLETE"
Write-Host "======================================"