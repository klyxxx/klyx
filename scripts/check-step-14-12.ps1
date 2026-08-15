$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$target =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.12 : accounts/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_ACTIVE_PROFILE_DELETE_GUARD_14_12",
    "KLYX_ACTIVE_PROFILE_DELETE_NOTICE_14_12",
    "profile.id === activeProfileId",
    "isActive ||",
    "Active d’abord un autre profil",
    "conserver au moins un profil",
    "deleteProfile",
    "switchAccount",
    "profiles.length <= 1"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.12 : signal manquant : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.12 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.12 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.12 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.12 CHECK OK"
Write-Host "======================================"
Write-Host "Active profile delete : BLOCKED"
Write-Host "Last profile delete   : BLOCKED"
Write-Host "Inactive delete       : READY"
Write-Host "Profile switching     : READY"
Write-Host "Tests                 : OK"
Write-Host "TypeScript            : OK"
Write-Host "Build                 : OK"
Write-Host "======================================"