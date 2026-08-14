$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-48-tracked-unreferenced-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-tracked-unreferenced-audit-13-48.json"

Write-Host ""
Write-Host "KLYX 13.48 tracked-unreferenced deep audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.48 runner FAILED."
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
    throw "13.48 : audit incomplet."
}

if (
    $data.AuditOnly -ne
    $true
) {
    throw "13.48 : audit-only invalide."
}

if (
    [int]$data.FilesMoved -ne
    0
) {
    throw "13.48 : fichiers deplaces."
}

if (
    [int]$data.FilesDeleted -ne
    0
) {
    throw "13.48 : fichiers supprimes."
}

if (
    [int]$data.SourceFilesModified -ne
    0
) {
    throw "13.48 : sources modifiees."
}

if (
    $data.RepositoryModified -ne
    $false
) {
    throw "13.48 : repository modifie."
}

if (
    [int]$data.MissingTrackedCount -gt
    0
) {
    throw "13.48 : fichiers suivis Git manquants."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.48 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.48 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.48 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.48 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Tracked-unreferenced candidates : " +
    $data.CandidateCount
)
Write-Host (
    "Runtime files preserved : " +
    $data.KeepRuntimeCount
)
Write-Host (
    "Referenced files preserved : " +
    $data.KeepReferencedCount
)
Write-Host (
    "Git-dirty files preserved : " +
    $data.KeepDirtyCount
)
Write-Host (
    "Archive-review candidates : " +
    $data.ArchiveReviewCount
)
Write-Host "Missing tracked files : 0"
Write-Host "Repository changes : NONE"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"