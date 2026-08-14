$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-39-migration-repair-plan.ps1"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-plan-13-39.json"

$commandsPath =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-commands-13-39.txt"

Write-Host ""
Write-Host "KLYX 13.39 migration repair planning..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

$runnerExit =
    $LASTEXITCODE

if (
    $runnerExit -eq 39
) {
    throw (
        "13.39 : versions distantes inconnues. " +
        "Repair volontairement bloque."
    )
}

if (
    $runnerExit -ne 0
) {
    throw "KLYX 13.39 runner FAILED."
}

foreach (
    $required
    in @(
        $jsonPath,
        $commandsPath
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $required
        )
    ) {
        throw (
            "13.39 : rapport introuvable : " +
            $required
        )
    }
}

$data =
    Get-Content `
        -LiteralPath `
        $jsonPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.RepairPlanOnly -ne
    $true
) {
    throw "13.39 : mode plan-only invalide."
}

if (
    $data.RepairPlanSafe -ne
    $true
) {
    throw "13.39 : plan de repair non sur."
}

if (
    @(
        $data.UnknownRemoteVersions
    ).Count -gt 0
) {
    throw "13.39 : versions distantes inconnues."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.39 : production modifiee."
}

if (
    $data.SchemaModified -ne
    $false
) {
    throw "13.39 : schema modifie."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.39 : linked write interdit."
}

if (
    $data.MigrationRepairExecuted -ne
    $false
) {
    throw "13.39 : migration repair execute trop tot."
}

if (
    $data.DbPushLinkedUsed -ne
    $false
) {
    throw "13.39 : db push linked interdit."
}

if (
    $data.DbResetLinkedUsed -ne
    $false
) {
    throw "13.39 : db reset linked interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.39 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.39 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.39 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.39 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Versions to mark reverted : " +
    $data.RevertCount
)
Write-Host (
    "Versions to mark applied : " +
    $data.ApplyCount
)
Write-Host "Unknown remote versions : 0"
Write-Host "Repair commands : GENERATED ONLY"
Write-Host "migration repair executed : NON"
Write-Host "Production schema modified : NON"
Write-Host "Production linked writes : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"