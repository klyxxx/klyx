$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-34-local-rebuild.ps1"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-local-rebuild-13-34.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-local-rebuild-13-34.txt"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $runner
    )
) {
    throw "13.34 : runner introuvable."
}

Write-Host ""
Write-Host "Disposable Supabase rebuild..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

$runnerExit =
    $LASTEXITCODE

if (
    -not (
        Test-Path `
            -LiteralPath `
            $jsonPath
    )
) {
    throw "13.34 : rapport JSON introuvable."
}

$data =
    Get-Content `
        -LiteralPath `
        $jsonPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.34 : production DB modifiee."
}

if (
    $data.LinkedResetUsed -ne
    $false
) {
    throw "13.34 : --linked interdit."
}

if (
    $data.DbUrlUsed -ne
    $false
) {
    throw "13.34 : --db-url interdit."
}

if (
    $runnerExit -eq 20
) {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX 13.34 ENVIRONMENT BLOCKED"
    Write-Host "======================================"
    Write-Host "Docker : REQUIS"
    Write-Host "Production DB : NON TOUCHEE"
    Write-Host "======================================"

    throw "KLYX 13.34 Docker local requis."
}

if (
    $runnerExit -eq 30
) {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX 13.34 REBUILD FAILED SAFELY"
    Write-Host "======================================"
    Write-Host (
        "Migration fautive : " +
        $data.FailedMigration
    )
    Write-Host "Production DB : NON TOUCHEE"
    Write-Host "======================================"

    throw "KLYX 13.34 migration order/schema failure."
}

if (
    $runnerExit -ne 0
) {
    throw "KLYX 13.34 runner FAILED."
}

if (
    $data.ResetSucceeded -ne
    $true
) {
    throw "13.34 : reconstruction non validee."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.34 automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.34 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.34 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.34 CHECK OK"
Write-Host "======================================"
Write-Host "Disposable Supabase project : OK"
Write-Host "Fresh local database : RECONSTRUITE"
Write-Host "Staging migrations replay : OK"
Write-Host "Migration ordering : VALIDE"
Write-Host "Docker/local stack : OK"
Write-Host "--local reset : UTILISE"
Write-Host "--linked reset : NON"
Write-Host "--db-url : NON"
Write-Host "Production DB modified : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"