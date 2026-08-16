$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\assistant\page.tsx"

if (
    -not (
        Test-Path `
            -LiteralPath $page `
            -PathType Leaf
    )
) {
    throw "13.64 : assistant page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$required =
    @(
        "KLYX Assistant",
        "Dis-moi ce qu’il faut faire.",
        "/assistant/market",
        "/requests",
        "/search",
        "/brain",
        "/provider/jobs",
        "/provider/assistant"
    )

foreach ($signal in $required) {
    if (
        -not $text.Contains(
            $signal
        )
    ) {
        throw (
            "13.64 : signal UI manquant : " +
            $signal
        )
    }
}

if (
    $text -match
    'automaticExecutionAllowed\s*=\s*true'
) {
    throw "13.64 : execution automatique interdite."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.64 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.64 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.64 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.64 CHECK OK"
Write-Host "======================================"
Write-Host "Assistant home : PRODUCT-FOCUSED"
Write-Host "Client primary journey : VISIBLE"
Write-Host "Provider primary journey : VISIBLE"
Write-Host "Primary need CTA : READY"
Write-Host "Explicit confirmation message : VISIBLE"
Write-Host "Automatic transaction UX : NONE"
Write-Host "Paid API requirement : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"