$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\onboarding\FirstProfileSetup.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.87 : FirstProfileSetup.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_FIRST_PROFILE_HANDOFF_13_87",
    "KLYX_INITIAL_ROLE_CONTEXT_13_87",
    "KLYX_PROFILE_NEXT_STEP_PREVIEW_13_87",
    "initialAccountType",
    "Espace prestataire sélectionné",
    "Espace client sélectionné",
    "Après cette étape",
    "opportunités compatibles",
    "confirmer toi-même",
    "function NextStep",
    "/api/profiles/manage",
    'method:',
    '"POST"',
    "accountType",
    "serviceId",
    "router.refresh()",
    "ne déclenche aucune",
    "paiement automatiquement"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.87 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.87 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.87 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.87 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.87 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.87 CHECK OK"
Write-Host "======================================"
Write-Host "First profile setup : READY"
Write-Host "Signup role continuity : READY"
Write-Host "Client handoff preview : READY"
Write-Host "Provider handoff preview : READY"
Write-Host "Provider service selection : PRESERVED"
Write-Host "Active profile creation : PRESERVED"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic offer : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"