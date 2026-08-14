$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-46-artifact-usage-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-artifact-usage-audit-13-46.json"

Write-Host ""
Write-Host "KLYX 13.46 artifact usage audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.46 runner FAILED."
}

if (
    -not (
        Test-Path `
            -LiteralPath `
            $manifestPath
    )
) {
    throw "13.46 : manifest introuvable."
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
    throw "13.46 : audit incomplet."
}

if (
    $data.AuditOnly -ne
    $true
) {
    throw "13.46 : audit-only invalide."
}

if (
    [int]$data.FilesMoved -ne
    0
) {
    throw "13.46 : fichiers deplaces."
}

if (
    [int]$data.FilesDeleted -ne
    0
) {
    throw "13.46 : fichiers supprimes."
}

if (
    [int]$data.SourceFilesModified -ne
    0
) {
    throw "13.46 : sources modifiees."
}

if (
    $data.RepositoryModified -ne
    $false
) {
    throw "13.46 : repository modifie."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.46 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.46 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.46 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.46 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Artifact candidates : " +
    $data.CandidateCount
)
Write-Host (
    "Used / keep : " +
    $data.UsedCount
)
Write-Host (
    "Tracked unreferenced / review : " +
    $data.TrackedUnreferencedCount
)
Write-Host (
    "Dead candidates : " +
    $data.DeadCandidateCount
)
Write-Host "Repository changes : NONE"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"