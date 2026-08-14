$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-37-controlled-cutover.ps1"

$manifest =
    Join-Path `
        $root `
        "reports\supabase-controlled-cutover-manifest-13-37.json"

Write-Host ""
Write-Host "KLYX 13.37 controlled migration cutover..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.37 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifest `
        -Raw |
    ConvertFrom-Json

if (
    $data.ArchiveHashesVerified -ne
    $true
) {
    throw "13.37 : archive non valide."
}

if (
    $data.CriticalSchemaVerified -ne
    $true
) {
    throw "13.37 : schema critique non valide."
}

if (
    $data.FreshLocalRebuildSucceeded -ne
    $true
) {
    throw "13.37 : fresh rebuild non valide."
}

if (
    [int]$data.OfficialMigrationCountAfter -ne
    1
) {
    throw "13.37 : nombre migrations officiel invalide."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.37 : production modifiee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.37 : linked write interdit."
}

if (
    $data.DbPushLinkedUsed -ne
    $false
) {
    throw "13.37 : db push linked interdit."
}

if (
    $data.DbResetLinkedUsed -ne
    $false
) {
    throw "13.37 : db reset linked interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.37 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.37 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.37 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.37 CHECK OK"
Write-Host "======================================"
Write-Host "Historical official migrations : ARCHIVED"
Write-Host "Archive hashes : VERIFIED"
Write-Host "Canonical baseline : OFFICIAL LOCAL"
Write-Host "supabase/migrations count : 1"
Write-Host "Fresh database rebuild : OK"
Write-Host "Critical schema : OK"
Write-Host "Production linked writes : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"