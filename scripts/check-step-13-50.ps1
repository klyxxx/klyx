$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-50-controlled-git-removal.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-controlled-git-removal-13-50.json"

Write-Host ""
Write-Host "KLYX 13.50 controlled Git removal..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.50 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.RemovalComplete -ne
    $true
) {
    throw "13.50 : retrait incomplet."
}

if (
    $data.ArchiveHashesVerified -ne
    $true
) {
    throw "13.50 : archive invalide."
}

if (
    $data.CanonicalMigrationPreserved -ne
    $true
) {
    throw "13.50 : migration canonique affectee."
}

if (
    [int]$data.FilesIrreversiblyDeleted -ne
    0
) {
    throw "13.50 : suppression irreversible."
}

if (
    $data.CleanupRecoverable -ne
    $true
) {
    throw "13.50 : cleanup non recuperable."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.50 : production modifiee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.50 : linked write interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.50 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.50 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.50 build FAILED."
}

Write-Host ""
Write-Host "Git status..."
Write-Host ""

git status --short

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.50 : git status FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.50 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Files removed from Git : " +
    $data.GitRemovedCount
)
Write-Host "Recovery archive : AVAILABLE"
Write-Host "Archive hashes : VERIFIED"
Write-Host "Canonical migration : PRESERVED"
Write-Host "Irreversible deletions : 0"
Write-Host "Production linked writes : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"