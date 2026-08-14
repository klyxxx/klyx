$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-49-git-removal-plan-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-git-removal-plan-13-49.json"

Write-Host ""
Write-Host "KLYX 13.49 git removal plan audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.49 runner FAILED."
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
    throw "13.49 : audit incomplet."
}

if (
    $data.PlanOnly -ne
    $true
) {
    throw "13.49 : mode plan-only invalide."
}

if (
    $data.GitRmExecuted -ne
    $false
) {
    throw "13.49 : git rm execute trop tot."
}

if (
    [int]$data.FilesDeleted -ne
    0
) {
    throw "13.49 : fichiers supprimes."
}

if (
    [int]$data.FilesMoved -ne
    0
) {
    throw "13.49 : fichiers deplaces."
}

if (
    [int]$data.SourceFilesModified -ne
    0
) {
    throw "13.49 : source modifiee."
}

if (
    $data.RepositoryModified -ne
    $false
) {
    throw "13.49 : repository modifie."
}

if (
    $data.GitStatusUnchanged -ne
    $true
) {
    throw "13.49 : git status modifie."
}

if (
    $data.HeadUnchanged -ne
    $true
) {
    throw "13.49 : HEAD modifie."
}

if (
    [int]$data.BlockedDirtyCount -gt
    0
) {
    throw (
        "13.49 : candidats dirty detectes. " +
        "Retrait Git bloque."
    )
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.49 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.49 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.49 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.49 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Removal-plan candidates : " +
    $data.EligibleRemovalPlanCount
)
Write-Host "Dirty candidates : 0"
Write-Host "Candidate diffs : GENERATED"
Write-Host "git rm commands : GENERATED ONLY"
Write-Host "git rm executed : NON"
Write-Host "Repository changes : NONE"
Write-Host "Git status : UNCHANGED"
Write-Host "HEAD : UNCHANGED"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"