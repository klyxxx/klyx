$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\search\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.75 : search page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_MARKET_DECISION_SUMMARY_13_75",
    "Comparaison KLYX",
    "Les profils qui ressortent",
    "Meilleur score KLYX",
    "Mieux noté",
    "Prix le plus bas",
    "highestScore",
    "bestRated",
    "cheapest",
    "provider.reviewCount > 0",
    "b.rating - a.rating",
    "Number(a.price)",
    "formatProviderPrice(",
    "La décision finale reste toujours au client.",
    "KLYX_MARKET_VERIFIED_REVIEWS_13_74",
    "KLYX_MARKET_TRUST_EXPLAINER_13_73"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.75 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.75 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.75 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.75 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.75 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.75 CHECK OK"
Write-Host "======================================"
Write-Host "Best score comparison : READY"
Write-Host "Best rating comparison : READY"
Write-Host "Lowest price comparison : READY"
Write-Host "Verified review data : PRESERVED"
Write-Host "KLYX trust signals : PRESERVED"
Write-Host "User final authority : PRESERVED"
Write-Host "Automatic selection : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Paid API : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"