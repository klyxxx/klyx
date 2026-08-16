$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\components\AccountSwitcher.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.08 : AccountSwitcher.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_ACTIVE_PROFILE_ROLE_14_08",
    "KLYX_ACTIVE_PROFILE_ROLE_BADGE_14_08",
    "currentRoleLabel",
    '"Prestataire"',
    '"Client"',
    "currentProfile.accountType",
    "currentProfileId",
    "switchAccount",
    "router.replace(",
    "router.refresh()"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.08 : signal manquant : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.08 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.08 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.08 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.08 CHECK OK"
Write-Host "======================================"
Write-Host "Active profile name : READY"
Write-Host "Active role         : READY"
Write-Host "Profile switching   : PRESERVED"
Write-Host "Tests               : OK"
Write-Host "TypeScript          : OK"
Write-Host "Build               : OK"
Write-Host "======================================"