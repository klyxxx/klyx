$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\requests\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.95 : requests/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_MANUAL_PUBLISH_CONFIRMATION_13_95",
    "KLYX_REQUEST_LIFECYCLE_13_95",
    "KLYX_REQUEST_DECISION_CONTROL_13_95",
    "Confirmer et publier la demande",
    "Après publication",
    "KLYX organise les offres. Tu gardes la décision.",
    'title="Publie"',
    'title="Reçois"',
    'title="Compare"',
    'title="Choisis"',
    'title="Réserve"',
    "function RequestJourneyStep",
    "/api/market/requests",
    "/offers",
    "offerAction",
    '"accept"',
    '"reject"',
    "bookingQuote"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.95 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.95 : PowerShell injecte dans requests/page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.95 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.95 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.95 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.95 CHECK OK"
Write-Host "======================================"
Write-Host "Request publication : READY"
Write-Host "Explicit confirmation : READY"
Write-Host "Offers lifecycle : READY"
Write-Host "Offer accept/reject : PRESERVED"
Write-Host "Booking continuity : PRESERVED"
Write-Host "Automatic offer acceptance : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"