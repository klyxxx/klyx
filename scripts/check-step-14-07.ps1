$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$switcherPath =
    Join-Path `
        $root `
        "app\components\AccountSwitcher.tsx"

$accountsPath =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

if (-not (Test-Path -LiteralPath $switcherPath -PathType Leaf)) {
    throw "14.07 : AccountSwitcher.tsx introuvable."
}

if (-not (Test-Path -LiteralPath $accountsPath -PathType Leaf)) {
    throw "14.07 : accounts/page.tsx introuvable."
}

$switcher =
    [System.IO.File]::ReadAllText(
        $switcherPath
    )

$accounts =
    [System.IO.File]::ReadAllText(
        $accountsPath
    )

foreach ($signal in @(
    "KLYX_SWITCHER_PROFILE_CREATION_14_07",
    "Ajouter un client",
    "Ajouter un prestataire",
    "/accounts?new=1&type=client",
    "/accounts?new=1&type=provider",
    "BriefcaseBusiness",
    "switchAccount",
    "currentProfileId",
    "Gérer mes profils"
)) {
    if (-not $switcher.Contains($signal)) {
        throw "14.07 : signal switcher manquant : $signal"
    }
}

foreach ($signal in @(
    'query.get("type")',
    "requestedType",
    "provider",
    "client",
    "openCreateForm"
)) {
    if (-not $accounts.Contains($signal)) {
        throw "14.07 : signal accounts manquant : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.07 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.07 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.07 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.07 CHECK OK"
Write-Host "======================================"
Write-Host "Profile switch        : READY"
Write-Host "Client shortcut       : READY"
Write-Host "Provider shortcut     : READY"
Write-Host "Role preselection     : READY"
Write-Host "Accounts handoff      : READY"
Write-Host "Tests                 : OK"
Write-Host "TypeScript            : OK"
Write-Host "Build                 : OK"
Write-Host "======================================"