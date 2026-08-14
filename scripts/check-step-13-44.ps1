$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-44-repository-hygiene-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-hygiene-audit-13-44.json"

Write-Host ""
Write-Host "KLYX 13.44 repository hygiene audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.44 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.AuditComplete -ne
    $true
) {
    throw "13.44 : audit incomplet."
}

if (
    $data.AuditOnly -ne
    $true
) {
    throw "13.44 : mode audit-only invalide."
}

if (
    [int]$data.FilesDeleted -ne
    0
) {
    throw "13.44 : fichiers supprimes."
}

if (
    [int]$data.FilesMoved -ne
    0
) {
    throw "13.44 : fichiers deplaces."
}

if (
    [int]$data.SourceFilesModified -ne
    0
) {
    throw "13.44 : sources modifiees."
}

if (
    $data.RepositoryModified -ne
    $false
) {
    throw "13.44 : repository modifie."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.44 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.44 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.44 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.44 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Backup candidates : " +
    $data.BackupCandidateCount
)
Write-Host (
    "Artifact candidates : " +
    $data.ArtifactCandidateCount
)
Write-Host (
    "Temporary directories : " +
    $data.KnownTempDirectoryCount
)
Write-Host (
    "Dangerous compilable backups : " +
    $data.DangerousCompilableBackupCount
)
Write-Host "Repository changes : NONE"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"