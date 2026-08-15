$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$audit =
    Join-Path `
        $root `
        "scripts\run-step-13-63-client-provider-flow-audit.ps1"

if (
    -not (
        Test-Path `
            -LiteralPath $audit `
            -PathType Leaf
    )
) {
    throw "13.63 : audit script introuvable."
}

Write-Host ""
Write-Host "Running real product-flow audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $audit

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.63 : product-flow audit FAILED."
}

$json =
    Join-Path `
        $root `
        "reports\client-provider-flow-audit-13-63.json"

$txt =
    Join-Path `
        $root `
        "reports\client-provider-flow-audit-13-63.txt"

foreach ($file in @(
    $json,
    $txt
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw "13.63 : rapport manquant : $file"
    }
}

$data =
    Get-Content `
        -LiteralPath $json `
        -Raw |
    ConvertFrom-Json

if (
    $data.productionWrites -ne
    $false
) {
    throw "13.63 : audit contient des writes."
}

if (
    $data.paidApiCalls -ne
    $false
) {
    throw "13.63 : audit utilise API payante."
}

if (
    $data.automaticExecutionAllowed -ne
    $false
) {
    throw "13.63 : automatic execution invalide."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.63 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.63 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.63 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.63 CHECK OK"
Write-Host "======================================"
Write-Host "Real client journey : AUDITED"
Write-Host "Provider onboarding : AUDITED"
Write-Host "Product gaps : IDENTIFIABLE"
Write-Host "Production writes : NONE"
Write-Host "Paid API calls : NONE"
Write-Host "Operating cost : ZERO"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"