$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\reviews\[bookingId]\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.10 : review page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_REVIEW_EXPLICIT_NEXT_ACTION_14_10",
    "KLYX_REVIEW_NO_AUTO_REDIRECT_14_10",
    "Que veux-tu faire maintenant ?",
    "Voir le prestataire",
    "Retour à la mission",
    "Mes réservations",
    'href={`/providers/${providerId}`}',
    'href={`/bookings/${bookingId}`}',
    'href="/bookings"',
    "/api/reviews",
    "saveReview",
    "Publier mon avis"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.10 : signal manquant : $signal"
    }
}

if ($text -match 'window\.setTimeout[\s\S]{0,500}router\.push') {
    throw "14.10 : redirection automatique interdite encore presente."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.10 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.10 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.10 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.10 CHECK OK"
Write-Host "======================================"
Write-Host "Review save          : READY"
Write-Host "Review editing       : READY"
Write-Host "Automatic redirect   : NONE"
Write-Host "Provider action      : READY"
Write-Host "Mission action       : READY"
Write-Host "Bookings action      : READY"
Write-Host "Explicit user choice : READY"
Write-Host "Tests                : OK"
Write-Host "TypeScript           : OK"
Write-Host "Build                : OK"
Write-Host "======================================"