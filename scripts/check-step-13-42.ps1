$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-42-post-cutover-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-post-cutover-audit-13-42.json"

Write-Host ""
Write-Host "KLYX 13.42 post-cutover integrity audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.42 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.PostCutoverAuditComplete -ne
    $true
) {
    throw "13.42 : audit incomplet."
}

if (
    [int]$data.LocalOfficialMigrationCount -ne
    1
) {
    throw "13.42 : historique local non canonique."
}

if (
    [int]$data.RemoteMigrationCount -ne
    1
) {
    throw "13.42 : historique distant non canonique."
}

if (
    [string]$data.CanonicalBaselineVersion -ne
    "20260814000000"
) {
    throw "13.42 : mauvaise version canonique."
}

if (
    $data.LocalRemoteHistoryAligned -ne
    $true
) {
    throw "13.42 : historique local/remote non aligne."
}

if (
    $data.FreshLocalRebuildSucceeded -ne
    $true
) {
    throw "13.42 : fresh rebuild invalide."
}

if (
    $data.ObjectInventoriesEqual -ne
    $true
) {
    throw "13.42 : schema remote/local different."
}

if (
    $data.CriticalTablesPresent -ne
    $true
) {
    throw "13.42 : schema critique incomplet."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.42 : linked write interdit."
}

if (
    $data.MigrationRepairExecuted -ne
    $false
) {
    throw "13.42 : migration repair inattendu."
}

if (
    $data.DbPushLinkedUsed -ne
    $false
) {
    throw "13.42 : db push linked interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.42 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.42 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.42 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.42 CHECK OK"
Write-Host "======================================"
Write-Host "Canonical migration version : 20260814000000"
Write-Host "Local migration history : ALIGNED"
Write-Host "Remote migration history : ALIGNED"
Write-Host "Fresh canonical rebuild : OK"
Write-Host "Remote/local schema inventory : MATCH"
Write-Host "Critical KLYX schema : PRESENT"
Write-Host "Production linked writes : NON"
Write-Host "migration repair : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"