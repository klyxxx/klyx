$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$target =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.06 : accounts/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_EXPLICIT_PROFILE_CREATION_14_06",
    "KLYX_PROFILE_TYPE_GUIDANCE_14_06",
    'openCreateForm("client")',
    'openCreateForm("provider")',
    "Ajouter un client",
    "Ajouter un prestataire",
    "Chaque profil garde son propre rôle",
    "MAX_PROFILES",
    "createProfile",
    "switchAccount",
    "updateProfile",
    "deleteProfile",
    "Profil créé et activé sans nouveau mot de passe."
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "14.06 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "14.06 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.06 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.06 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.06 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.06 CHECK OK"
Write-Host "======================================"
Write-Host "Client profile creation   : READY"
Write-Host "Provider profile creation : READY"
Write-Host "Multi-profile architecture: READY"
Write-Host "Profile switch            : PRESERVED"
Write-Host "Profile edit              : PRESERVED"
Write-Host "Profile delete            : PRESERVED"
Write-Host "Single login              : PRESERVED"
Write-Host "Tests                     : OK"
Write-Host "TypeScript                : OK"
Write-Host "Build                     : OK"
Write-Host "======================================"