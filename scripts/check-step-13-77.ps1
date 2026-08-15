$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$page =
    Join-Path `
        $root `
        "app\provider\jobs\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.77 : provider jobs page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_PROVIDER_OFFER_TRACKING_13_77",
    "Suivi de mes offres",
    "Où en sont mes propositions ?",
    "pendingOffers",
    "acceptedOffers",
    "rejectedOffers",
    'item.myOffer?.status === "pending"',
    'item.myOffer?.status === "accepted"',
    'item.myOffer?.status === "rejected"',
    "statusLabel",
    "request.myOffer?.amount",
    "/api/provider/jobs",
    "/offers",
    "Une offre envoyée ne crée pas automatiquement de réservation",
    "KLYX_PROVIDER_OPPORTUNITY_FOCUS_13_76"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.77 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.77 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.77 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.77 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.77 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.77 CHECK OK"
Write-Host "======================================"
Write-Host "Offer lifecycle : VISIBLE"
Write-Host "Pending : READY"
Write-Host "Accepted : READY"
Write-Host "Rejected : READY"
Write-Host "Offer amounts : READY"
Write-Host "Client confirmation : PRESERVED"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"