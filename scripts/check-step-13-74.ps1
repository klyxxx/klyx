$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\search\page.tsx"

$providerSearch =
    Join-Path `
        $root `
        "lib\provider-search.ts"

foreach ($file in @(
    $page,
    $providerSearch
)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "13.74 : fichier manquant : $file"
    }
}

$pageText =
    [System.IO.File]::ReadAllText(
        $page
    )

$typeText =
    [System.IO.File]::ReadAllText(
        $providerSearch
    )

$pageSignals = @(
    "KLYX_MARKET_VERIFIED_REVIEWS_13_74",
    'label="Avis vérifiés"',
    "provider.reviewCount > 0",
    "provider.rating.toFixed(1)",
    '${provider.reviewCount} avis',
    '"Aucun avis"',
    "positive={provider.reviewCount > 0}",
    "KLYX_MARKET_TRUST_EXPLAINER_13_73",
    "<MatchExplanation"
)

foreach ($signal in $pageSignals) {
    if (-not $pageText.Contains($signal)) {
        throw "13.74 : page signal manquant : $signal"
    }
}

$typeSignals = @(
    "rating: number;",
    "reviewCount: number;",
    '"rating_desc"',
    'label: "Mieux notés"'
)

foreach ($signal in $typeSignals) {
    if (-not $typeText.Contains($signal)) {
        throw "13.74 : provider-search signal manquant : $signal"
    }
}

if ($pageText.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.74 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.74 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.74 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.74 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.74 CHECK OK"
Write-Host "======================================"
Write-Host "Marketplace rating : VISIBLE"
Write-Host "Verified review count : VISIBLE"
Write-Host "No-review state : HANDLED"
Write-Host "Rating data contract : PRESERVED"
Write-Host "Rating sorting : PRESERVED"
Write-Host "KLYX trust explainer : PRESERVED"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Paid API : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"