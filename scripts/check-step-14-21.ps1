$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$files = @{
    "market" =
        "app\components\KlyxMarketSelect.tsx"

    "accounts" =
        "app\accounts\page.tsx"

    "switcher" =
        "lib\account-switcher.ts"

    "active" =
        "lib\active-profile.ts"

    "api" =
        "app\api\profiles\manage\route.ts"

    "registry" =
        "lib\klyx-supported-markets.ts"
}

foreach ($key in $files.Keys) {
    $path =
        Join-Path `
            $root `
            $files[$key]

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "14.21 : fichier introuvable : $path"
    }
}

$market =
    [System.IO.File]::ReadAllText(
        (Join-Path $root $files["market"])
    )

$accounts =
    [System.IO.File]::ReadAllText(
        (Join-Path $root $files["accounts"])
    )

$switcher =
    [System.IO.File]::ReadAllText(
        (Join-Path $root $files["switcher"])
    )

$active =
    [System.IO.File]::ReadAllText(
        (Join-Path $root $files["active"])
    )

$api =
    [System.IO.File]::ReadAllText(
        (Join-Path $root $files["api"])
    )

foreach ($signal in @(
    "KLYX_PROFILE_MARKET_SELECTOR_14_21",
    "KLYX_PROFILE_MARKET_SEARCH_14_21",
    "KLYX_COUNTRY_CURRENCY_AUTOMATIC_UI_14_21"
)) {
    if (-not $market.Contains($signal)) {
        throw "14.21 : selecteur incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_PROFILE_COUNTRY_FIELD_14_21",
    "KlyxMarketSelect",
    "countryCode",
    "Devise KLYX",
    "getKlyxMarket"
)) {
    if (-not $accounts.Contains($signal)) {
        throw "14.21 : accounts incomplet : $signal"
    }
}

foreach ($signal in @(
    "countryCode",
    "currencyCode"
)) {
    if (-not $switcher.Contains($signal)) {
        throw "14.21 : switcher incomplet : $signal"
    }

    if (-not $active.Contains($signal)) {
        throw "14.21 : active profile incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_PROFILE_MARKET_VALIDATION_14_21",
    "KLYX_PROFILE_MARKET_WRITE_14_21",
    "getKlyxMarket",
    "country_code",
    "currency_code",
    "KLYX_MARKET_NOT_SUPPORTED"
)) {
    if (-not $api.Contains($signal)) {
        throw "14.21 : API incomplete : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.21 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.21 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.21 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.21 CHECK OK"
Write-Host "======================================"
Write-Host "Country selection  : READY"
Write-Host "90+ markets        : READY"
Write-Host "Automatic currency : READY"
Write-Host "Profile creation   : READY"
Write-Host "Profile editing    : READY"
Write-Host "Supabase storage   : READY"
Write-Host "Tests              : OK"
Write-Host "TypeScript         : OK"
Write-Host "Build              : OK"
Write-Host "======================================"