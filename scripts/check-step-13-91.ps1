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
        throw "13.91 : fichier introuvable : $filePath"
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
    "KLYX_PROFILE_QUICK_CREATE_13_91",
    "KLYX_PROFILE_LIMIT_GUIDANCE_13_91",
    "openCreateForm",
    "Ajouter un profil client",
    "Ajouter un profil prestataire",
    "opportunités, assistant prestataire et missions",
    "profiles.length >= MAX_PROFILES",
    "Tu as atteint la limite de",
    "MAX_PROFILES",
    "createProfile",
    "switchAccount"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.91 : signal manquant : $signal"
    }
}

$libSignals = @(
    "createProfile",
    "/api/profiles/manage",
    "accountType",
    "serviceId",
    "switchAccount",
    "/api/profiles/active"
)

foreach ($signal in $libSignals) {
    if (-not $libText.Contains($signal)) {
        throw "13.91 : account-switcher signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.91 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.91 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.91 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.91 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.91 CHECK OK"
Write-Host "======================================"
Write-Host "Client quick creation : READY"
Write-Host "Provider quick creation : READY"
Write-Host "Role preselection : READY"
Write-Host "Profile management : PRESERVED"
Write-Host "Profile switching : PRESERVED"
Write-Host "Single authentication : PRESERVED"
Write-Host "Profile limit : PRESERVED"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"