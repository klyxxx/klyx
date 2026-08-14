$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-43-migration-directory-hygiene.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-migration-hygiene-13-43.json"

Write-Host ""
Write-Host "KLYX 13.43 migration directory hygiene..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.43 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.HygieneComplete -ne
    $true
) {
    throw "13.43 : hygiene incomplete."
}

if (
    [int]$data.OfficialSqlMigrationCount -ne
    1
) {
    throw "13.43 : migration officielle != 1."
}

if (
    [int]$data.BackupArtifactsRemaining -ne
    0
) {
    throw "13.43 : backups encore dans migrations."
}

if (
    [int]$data.MigrationListSkipWarnings -ne
    0
) {
    throw "13.43 : warnings CLI encore presents."
}

if (
    $data.ArchiveHashesVerified -ne
    $true
) {
    throw "13.43 : hashes archive invalides."
}

if (
    [int]$data.FilesDeleted -ne
    0
) {
    throw "13.43 : suppression fichier interdite."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.43 : linked write interdit."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.43 : production modifiee."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.43 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.43 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.43 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.43 CHECK OK"
Write-Host "======================================"
Write-Host "Supabase migrations directory : CLEAN"
Write-Host "Canonical migration count : 1"
Write-Host "Backup migration artifacts : ARCHIVED"
Write-Host "Archive hashes : VERIFIED"
Write-Host "CLI skip warnings : 0"
Write-Host "Files deleted : 0"
Write-Host "Production linked writes : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"