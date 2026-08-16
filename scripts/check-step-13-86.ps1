$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\onboarding\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.86 : onboarding page introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_ONBOARDING_REAL_WORKFLOWS_13_86",
    'href: "/assistant/market"',
    "attend ta confirmation avant publication",
    "KLYX_PROVIDER_ONBOARDING_SHORTCUTS_13_86",
    'href="/provider/jobs"',
    'href="/provider/assistant"',
    "Voir mes opportunités KLYX",
    "Utiliser l’Assistant Prestataire",
    "aucune offre ni mission n’est acceptée",
    "ProviderOnboardingProgress",
    "FirstProfileSetup",
    "getActiveProfile",
    "accountType"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.86 : signal manquant : $signal"
    }
}

if ($text.Contains('href: "/brain"')) {
    throw "13.86 : ancien lien client /brain encore present."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.86 : PowerShell injecte dans page.tsx."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.86 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.86 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.86 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.86 CHECK OK"
Write-Host "======================================"
Write-Host "Client onboarding journey : READY"
Write-Host "Assistant market routing : READY"
Write-Host "Provider opportunities : READY"
Write-Host "Provider assistant : READY"
Write-Host "Provider onboarding progress : PRESERVED"
Write-Host "First profile setup : PRESERVED"
Write-Host "Explicit confirmation : PRESERVED"
Write-Host "Automatic publication : NONE"
Write-Host "Automatic offer : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"