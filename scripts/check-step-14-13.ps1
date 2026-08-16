$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.13 : accounts/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_CREATED_PROFILE_NEXT_ACTION_14_13",
    "KLYX_CREATED_PROFILE_HANDOFF_14_13",
    "KLYX_CREATED_PROFILE_EXPLICIT_CONTROL_14_13",
    "createdAccountType",
    "setCreatedAccountType",
    "Préparer mon activité",
    "Organiser mon premier besoin",
    "Voir les opportunités",
    '"/provider"',
    '"/provider/jobs"',
    '"/assistant/market"',
    "createProfile",
    "switchAccount",
    "Profil créé et activé",
    "aucune action automatiquement"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.13 : signal manquant : $signal"
    }
}

if ($text.Contains("lastCreatedAccountType")) {
    throw "14.13 : ancien etat lastCreatedAccountType encore present."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.13 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.13 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.13 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.13 CHECK OK"
Write-Host "======================================"
Write-Host "Client handoff       : READY"
Write-Host "Provider handoff     : READY"
Write-Host "Created role state   : READY"
Write-Host "Explicit next action : READY"
Write-Host "Auto navigation      : NONE"
Write-Host "Profile creation     : PRESERVED"
Write-Host "Tests                : OK"
Write-Host "TypeScript           : OK"
Write-Host "Build                : OK"
Write-Host "======================================"