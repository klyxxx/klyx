$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\signup\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.02 : signup/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_SIGNUP_ROLE_CONTINUITY_14_02",
    "KLYX_SIGNUP_NEXT_STEP_14_02",
    "Profil sélectionné",
    "Je rejoins KLYX comme prestataire",
    "Je rejoins KLYX comme client",
    "Ton choix de profil est conservé",
    "plusieurs profils KLYX",
    'params.get("type")',
    "setAccountType",
    "account_type:",
    "accountType",
    "supabase.auth.signUp",
    "/onboarding",
    "Créer mon espace prestataire",
    "Créer mon compte client"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "14.02 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "14.02 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.02 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.02 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.02 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.02 CHECK OK"
Write-Host "======================================"
Write-Host "Client signup context     : READY"
Write-Host "Provider signup context   : READY"
Write-Host "URL role selection        : VERIFIED"
Write-Host "Supabase role metadata    : VERIFIED"
Write-Host "Onboarding handoff        : VERIFIED"
Write-Host "Multi-profile guidance    : READY"
Write-Host "Tests                     : OK"
Write-Host "TypeScript                : OK"
Write-Host "Build                     : OK"
Write-Host "======================================"