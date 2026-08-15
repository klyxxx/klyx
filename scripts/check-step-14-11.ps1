$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$target =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.11 : accounts/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_PROFILE_CAPACITY_14_11",
    "KLYX_PROFILE_LIMIT_GUARD_14_11",
    "{profiles.length} / {MAX_PROFILES} profils",
    "Tu as atteint la limite actuelle.",
    "profiles.length >= MAX_PROFILES",
    "MAX_PROFILES",
    "createProfile",
    "switchAccount",
    "deleteProfile",
    "updateProfile"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.11 : signal manquant : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.11 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.11 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.11 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.11 CHECK OK"
Write-Host "======================================"
Write-Host "Profile counter   : READY"
Write-Host "Capacity state    : READY"
Write-Host "Profile limit     : READY"
Write-Host "Creation guard    : PRESERVED"
Write-Host "Profile switch    : PRESERVED"
Write-Host "Tests             : OK"
Write-Host "TypeScript        : OK"
Write-Host "Build             : OK"
Write-Host "======================================"