$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\search\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.93 : search/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_SEARCH_ASSISTANT_BRIDGE_13_93",
    "KLYX_SEARCH_TWO_PATHS_13_93",
    "KLYX_SEARCH_CONFIRMATION_REMINDER_13_93",
    "/assistant/market",
    "Parcours assisté",
    "KLYX organise mon besoin",
    "Parcours manuel",
    "Je compare moi-même",
    "Utiliser l’assistant KLYX",
    "attend ta confirmation avant publication",
    "ne réserve et ne paie aucun prestataire sans ta confirmation",
    "/api/search/providers",
    "/api/services/public",
    "Critères de recherche",
    "Rechercher les prestataires",
    "bookingHref",
    "MatchExplanation",
    "SearchRecovery"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.93 : signal manquant : $signal"
    }
}

if ($text.Contains('href="/request"')) {
    throw "13.93 : ancien lien /request encore present."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.93 : PowerShell injecte dans search/page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.93 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.93 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.93 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.93 CHECK OK"
Write-Host "======================================"
Write-Host "Assistant search bridge : READY"
Write-Host "Manual search path : READY"
Write-Host "Explicit confirmation : READY"
Write-Host "Provider search API : PRESERVED"
Write-Host "Service filters : PRESERVED"
Write-Host "Booking flow : PRESERVED"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"