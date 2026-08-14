$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-32-plan.ps1"

$manifest =
    Join-Path `
        $root `
        "reports\supabase-fresh-rebuild-manifest-13-32.json"

$plan =
    Join-Path `
        $root `
        "reports\supabase-fresh-rebuild-plan-13-32.txt"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $runner
    )
) {
    throw "13.32 : runner introuvable."
}

Write-Host ""
Write-Host "Generating canonical migration plan..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.32 planning FAILED."
}

foreach (
    $path
    in @(
        $manifest,
        $plan
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.32 : rapport manquant : $path"
    }
}

$data =
    Get-Content `
        -LiteralPath `
        $manifest `
        -Raw |
    ConvertFrom-Json

if (
    $data.Step -ne
    "13.32"
) {
    throw "13.32 : manifest invalide."
}

if (
    $data.DestructiveChangesApplied -ne
    $false
) {
    throw "13.32 : modification destructive detectee."
}

if (
    $data.DatabaseModified -ne
    $false
) {
    throw "13.32 : base modifiee."
}

if (
    $data.FilesMoved -ne
    $false
) {
    throw "13.32 : fichiers deplaces."
}

if (
    $data.FilesDeleted -ne
    $false
) {
    throw "13.32 : fichiers supprimes."
}

if (
    @(
        $data.CanonicalPhases
    ).Count -lt 9
) {
    throw "13.32 : phases canoniques incompletes."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.32 automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.32 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.32 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.32 CHECK OK"
Write-Host "======================================"
Write-Host "Fresh rebuild manifest : GENERE"
Write-Host "Canonical migration phases : DEFINIES"
Write-Host "SQL SHA256 inventory : ACTIF"
Write-Host "Duplicate-content detection : ACTIVE"
Write-Host "Legacy review gate : ACTIF"
Write-Host "Remote snapshot exclusion gate : ACTIF"
Write-Host "Fresh DB target invariant : DEFINI"
Write-Host "SQL moved : NON"
Write-Host "SQL deleted : NON"
Write-Host "Production DB modified : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"