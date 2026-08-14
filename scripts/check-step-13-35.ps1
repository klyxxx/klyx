$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-35-baseline-fidelity.ps1"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-baseline-fidelity-13-35.json"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $runner
    )
) {
    throw "13.35 : runner introuvable."
}

Write-Host ""
Write-Host "KLYX 13.35 baseline fidelity..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.35 fidelity audit FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $jsonPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.ObjectInventoriesEqual -ne
    $true
) {
    throw "13.35 : schemas divergents."
}

if (
    $data.CriticalTablesPresent -ne
    $true
) {
    throw "13.35 : tables critiques manquantes."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.35 : production modifiee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.35 : linked write interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.35 automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.35 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.35 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.35 CHECK OK"
Write-Host "======================================"
Write-Host "Remote baseline : VERIFIED"
Write-Host "Fresh local replay : VERIFIED"
Write-Host "Tables fidelity : OK"
Write-Host "Views fidelity : OK"
Write-Host "Functions fidelity : OK"
Write-Host "Indexes fidelity : OK"
Write-Host "Policies fidelity : OK"
Write-Host "Triggers fidelity : OK"
Write-Host "Types fidelity : OK"
Write-Host "Critical KLYX schema : PRESENT"
Write-Host "Production linked writes : NON"
Write-Host "Official migrations modified : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"