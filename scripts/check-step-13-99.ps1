$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\reviews\[bookingId]\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.99 : review page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_VERIFIED_REVIEW_TRUST_13_99",
    "KLYX_REVIEW_TRUST_FLOW_13_99",
    "Un avis lié à une vraie mission KLYX",
    'title="Mission terminée"',
    'title="Avis vérifié"',
    'title="Confiance"',
    "function ReviewTrustStep",
    "/api/reviews",
    "bookingId",
    "rating",
    "comment",
    "Avis vérifié KLYX",
    "Publier mon avis",
    "Modifier mon avis"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.99 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.99 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.99 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.99 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.99 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.99 CHECK OK"
Write-Host "======================================"
Write-Host "Verified review : READY"
Write-Host "Trust context : READY"
Write-Host "Mission association : READY"
Write-Host "Review API : PRESERVED"
Write-Host "Review editing : PRESERVED"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"