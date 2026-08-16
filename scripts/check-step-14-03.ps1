$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\onboarding\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.03 : onboarding/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_ROLE_NEXT_ACTION_14_03",
    "KLYX_ROLE_SAFETY_CONTEXT_14_03",
    "Prochaine action",
    "Organise ton premier besoin avec KLYX.",
    "Prépare ton activité avant de répondre aux missions.",
    'href="/assistant/market"',
    'href="/search"',
    'href="/provider"',
    'href="/provider/jobs"',
    "Organiser mon besoin",
    "Préparer mon activité",
    "Voir les opportunités",
    "Chercher moi-même",
    "ProviderOnboardingProgress",
    'profile.accountType === "provider"',
    "Parcours prestataire",
    "Parcours client",
    "ne publie, ne réserve et ne paie rien",
    "ne répond à aucune mission automatiquement"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "14.03 : signal manquant : $signal"
    }
}

if ($text.Contains('href: "/brain"')) {
    throw "14.03 : ancien parcours client /brain encore actif."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "14.03 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.03 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.03 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.03 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.03 CHECK OK"
Write-Host "======================================"
Write-Host "Client onboarding        : READY"
Write-Host "Provider onboarding      : READY"
Write-Host "Assistant handoff        : READY"
Write-Host "Manual search            : READY"
Write-Host "Provider activity        : READY"
Write-Host "Provider opportunities   : READY"
Write-Host "Automatic publication    : NONE"
Write-Host "Automatic provider reply : NONE"
Write-Host "Tests                    : OK"
Write-Host "TypeScript               : OK"
Write-Host "Build                    : OK"
Write-Host "======================================"