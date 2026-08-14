$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-40-pre-repair-safety-gate.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-pre-repair-safety-13-40.json"

Write-Host ""
Write-Host "KLYX 13.40 final pre-repair safety gate..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.40 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.PreRepairSnapshotComplete -ne
    $true
) {
    throw "13.40 : snapshot incomplet."
}

if (
    $data.PlanCommandsWhitelisted -ne
    $true
) {
    throw "13.40 : commandes plan non autorisees."
}

if (
    $data.RemoteHistoryUnchangedSince13_39 -ne
    $true
) {
    throw "13.40 : historique distant modifie depuis 13.39."
}

if (
    $data.CriticalRemoteSchemaPresent -ne
    $true
) {
    throw "13.40 : schema distant critique incomplet."
}

if (
    $data.ReadyForMigrationHistoryRepair -ne
    $true
) {
    throw "13.40 : repair non autorise."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.40 : production DB modifiee."
}

if (
    $data.ProductionSchemaModified -ne
    $false
) {
    throw "13.40 : schema production modifie."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.40 : linked write interdit."
}

if (
    $data.MigrationRepairExecuted -ne
    $false
) {
    throw "13.40 : migration repair execute trop tot."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.40 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.40 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.40 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.40 CHECK OK"
Write-Host "======================================"
Write-Host "Remote schema snapshot : OK"
Write-Host "Remote migration snapshot : OK"
Write-Host "Snapshot hashes : OK"
Write-Host "Critical schema : OK"
Write-Host "13.39 command whitelist : OK"
Write-Host "Remote history unchanged : OK"
Write-Host "migration repair executed : NON"
Write-Host "Production schema modified : NON"
Write-Host "Production linked writes : NON"
Write-Host "Ready for controlled history repair : OUI"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"