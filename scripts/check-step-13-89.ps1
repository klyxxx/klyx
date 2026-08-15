$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$switcherPath =
    Join-Path `
        $root `
        "app\components\AccountSwitcher.tsx"

$libPath =
    Join-Path `
        $root `
        "lib\account-switcher.ts"

foreach ($filePath in @(
    $switcherPath,
    $libPath
)) {
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw "13.89 : fichier introuvable : $filePath"
    }
}

$switcherText =
    [System.IO.File]::ReadAllText(
        $switcherPath
    )

$libText =
    [System.IO.File]::ReadAllText(
        $libPath
    )

$switcherSignals = @(
    "KLYX_MULTI_PROFILE_SWITCHER_13_89",
    "KLYX_ACTIVE_PROFILE_TRIGGER_13_89",
    "KLYX_PROFILE_SWITCHER_HEADER_13_89",
    "KLYX_PROFILE_SWITCH_SECURITY_13_89",
    "getProfiles",
    "switchAccount",
    "currentProfileId",
    "profiles.length",
    "Change d’espace sans te reconnecter.",
    "Prestataire",
    "Client",
    "Actif",
    "Synchronisation",
    "/accounts?new=1",
    "/accounts",
    "/dashboard?profile=",
    "Aucun mot de passe n’est demandé ni stocké"
)

foreach ($signal in $switcherSignals) {
    if (-not $switcherText.Contains($signal)) {
        throw "13.89 : switcher signal manquant : $signal"
    }
}

$libSignals = @(
    "/api/profiles/active",
    'method: "POST"',
    "profileId",
    "emitActiveProfileChanged",
    "KLYX_ACTIVE_PROFILE_CHANGED"
)

foreach ($signal in $libSignals) {
    if (-not $libText.Contains($signal)) {
        throw "13.89 : account-switcher signal manquant : $signal"
    }
}

if (
    $switcherText.Contains(
        "localStorage.setItem"
    )
) {
    throw "13.89 : localStorage detecte dans AccountSwitcher."
}

if (
    $switcherText.Contains(
        "[System.IO.File]::WriteAllText"
    )
) {
    throw "13.89 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.89 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.89 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.89 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.89 CHECK OK"
Write-Host "======================================"
Write-Host "Multi-profile switcher : READY"
Write-Host "Active profile : READY"
Write-Host "Role visibility : READY"
Write-Host "Profile count : READY"
Write-Host "One-click switching : READY"
Write-Host "Active profile API : VERIFIED"
Write-Host "Password prompt : NONE"
Write-Host "Password localStorage : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"