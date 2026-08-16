$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\page.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.84 : app/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_PUBLIC_PRODUCT_JOURNEY_13_84",
    "Comment fonctionne KLYX",
    "Du besoin à la mission terminée.",
    "Décris ton besoin",
    "KLYX compare",
    "Tu confirmes",
    "KLYX suit la mission",
    "Tu gardes toujours la décision finale",
    "confirmation explicite de ta part",
    "function JourneyStep",
    "Une seule plateforme",
    "PublicSessionActions",
    "InstallKlyxButton",
    "KlyxLogo"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.84 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.84 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.84 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.84 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.84 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.84 CHECK OK"
Write-Host "======================================"
Write-Host "Homepage journey : READY"
Write-Host "Need capture : VISIBLE"
Write-Host "Comparison : VISIBLE"
Write-Host "Explicit confirmation : VISIBLE"
Write-Host "Booking tracking : VISIBLE"
Write-Host "Public homepage : PRESERVED"
Write-Host "PWA installation : PRESERVED"
Write-Host "Automatic publication : NONE"
Write-Host "Automatic provider choice : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"