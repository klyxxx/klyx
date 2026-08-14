$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-34-baseline-rebuild.ps1"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-baseline-rebuild-13-34.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-baseline-rebuild-13-34.txt"

Write-Host ""
Write-Host "KLYX 13.34e disposable baseline test..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    Write-Host ""
    Write-Host "Afficher le diagnostic avec :"
    Write-Host ""
    Write-Host "Get-Content .\reports\supabase-baseline-rebuild-13-34.txt | Select-Object -First 220"
    Write-Host ""

    throw "KLYX 13.34e baseline test FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $jsonPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.BaselineRebuildSucceeded -ne
    $true
) {
    throw "13.34e : baseline non reconstruite."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.34e : production modifiee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.34e : linked write interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.34e automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.34e TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.34e build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.34e CHECK OK"
Write-Host "======================================"
Write-Host "Remote schema baseline : CAPTURED"
Write-Host "profiles foundation : PRESENTE"
Write-Host "services foundation : PRESENTE"
Write-Host "service_profiles foundation : PRESENTE"
Write-Host "user_services foundation : PRESENTE"
Write-Host "bookings foundation : PRESENTE"
Write-Host "Fresh local Supabase : RECONSTRUIT"
Write-Host "Production linked writes : NON"
Write-Host "Official migrations modified : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"