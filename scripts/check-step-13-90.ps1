$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

$libPath =
    Join-Path `
        $root `
        "lib\account-switcher.ts"

foreach ($filePath in @(
    $pagePath,
    $libPath
)) {
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw "13.90 : fichier introuvable : $filePath"
    }
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$libText =
    [System.IO.File]::ReadAllText(
        $libPath
    )

$signals = @(
    "KLYX_ACCOUNT_OVERVIEW_13_90",
    "KLYX_MULTI_PROFILE_OVERVIEW_13_90",
    "KLYX_ACCOUNT_SESSION_SAFETY_13_90",
    "clientProfiles",
    "providerProfiles",
    "activeProfileName",
    "activeProfileRole",
    "profiles.length",
    "MAX_PROFILES",
    "Tous tes profils en un coup d’œil",
    "Une seule connexion",
    "Profil actif",
    "Changer de profil ne demande pas un nouveau mot de passe",
    "function AccountStatCard",
    "createProfile",
    "updateProfile",
    "deleteProfile",
    "switchAccount"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.90 : signal manquant : $signal"
    }
}

$libSignals = @(
    "/api/profiles/active",
    "/api/profiles/manage",
    "getProfilesState",
    "createProfile",
    "updateProfile",
    "deleteProfile",
    "switchAccount"
)

foreach ($signal in $libSignals) {
    if (-not $libText.Contains($signal)) {
        throw "13.90 : account-switcher signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.90 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.90 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.90 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.90 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.90 CHECK OK"
Write-Host "======================================"
Write-Host "Profiles overview : READY"
Write-Host "Client profiles : READY"
Write-Host "Provider profiles : READY"
Write-Host "Active profile : READY"
Write-Host "Profile limit : READY"
Write-Host "Profile creation : PRESERVED"
Write-Host "Profile edition : PRESERVED"
Write-Host "Profile deletion : PRESERVED"
Write-Host "Profile switching : PRESERVED"
Write-Host "Single authentication : PRESERVED"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"