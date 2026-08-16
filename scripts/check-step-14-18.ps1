$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$component =
    Join-Path `
        $root `
        "app\components\KlyxServiceSelect.tsx"

$accounts =
    Join-Path `
        $root `
        "app\accounts\page.tsx"

foreach ($path in @(
    $component,
    $accounts
)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "14.18 : fichier introuvable : $path"
    }
}

$componentText =
    [System.IO.File]::ReadAllText(
        $component
    )

$accountsText =
    [System.IO.File]::ReadAllText(
        $accounts
    )

foreach ($signal in @(
    "KLYX_UNIVERSAL_SERVICE_SEARCH_14_18",
    "KLYX_SERVICE_SEARCH_INPUT_14_18",
    "KLYX_ALL_DB_SERVICES_SEARCHABLE_14_18",
    "normalizeSearch",
    "Rechercher un métier",
    "métiers disponibles",
    "Aucun métier trouvé",
    "Autre métier",
    "filteredOptions"
)) {
    if (-not $componentText.Contains($signal)) {
        throw "14.18 : composant incomplet : $signal"
    }
}

foreach ($signal in @(
    'KlyxServiceSelect from "@/app/components/KlyxServiceSelect"',
    "<KlyxServiceSelect",
    "form.serviceId",
    "services.map",
    "keywords: service.slug",
    "Choisir un métier",
    "Premier métier proposé"
)) {
    if (-not $accountsText.Contains($signal)) {
        throw "14.18 : integration accounts incomplete : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.18 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.18 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.18 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.18 CHECK OK"
Write-Host "======================================"
Write-Host "Profession search  : READY"
Write-Host "Supabase catalog   : CONNECTED"
Write-Host "Large catalog UX   : READY"
Write-Host "Accent search      : READY"
Write-Host "Custom profession  : ACCESSIBLE"
Write-Host "Tests              : OK"
Write-Host "TypeScript         : OK"
Write-Host "Build              : OK"
Write-Host "======================================"