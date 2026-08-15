$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "lib\klyx-supported-markets.ts"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.19 : registre pays/devise introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_SUPPORTED_MARKETS_14_19",
    "KLYX_EURO_DOLLAR_GLOBAL_MARKETS_14_19",
    "KLYX_MARKETS_EUR_DOLLAR_READY_14_19",
    "KLYX_EURO_MARKETS",
    "KLYX_DOLLAR_MARKETS",
    "KLYX_SUPPORTED_MARKETS",
    "KLYX_SUPPORTED_COUNTRIES",
    "KLYX_SUPPORTED_TERRITORIES",
    "KLYX_SUPPORTED_CURRENCY_CODES",
    "getKlyxCurrencyForCountry",
    "getKlyxPaymentCurrency",
    "formatKlyxMoney",
    "Bulgarie",
    "Belgique",
    "États-Unis",
    "Canada",
    "Australie",
    "Nouvelle-Zélande",
    "Singapour",
    "Hong Kong",
    "Équateur",
    "Panama",
    "Bahamas",
    "Barbade",
    "Jamaïque",
    "Guyana",
    "Suriname",
    "Namibie",
    "Belize",
    "Liberia",
    "Îles Caïmans",
    "Bermudes",
    "EUR",
    "USD",
    "CAD",
    "AUD",
    "NZD",
    "SGD",
    "HKD",
    "BND",
    "TWD",
    "FJD",
    "SBD",
    "NAD",
    "LRD",
    "BZD",
    "GYD",
    "JMD",
    "BSD",
    "BBD",
    "TTD",
    "SRD",
    "XCD",
    "KYD",
    "BMD"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.19 : signal manquant : $signal"
    }
}

# ============================================================
# Vérifie le nombre de marchés
# ============================================================

$marketMatches =
    [regex]::Matches(
        $text,
        'countryCode:\s*"([^"]+)"'
    )

if ($marketMatches.Count -lt 90) {
    throw "14.19 : seulement $($marketMatches.Count) marches detectes."
}

# ============================================================
# Vérifie les doublons de countryCode
# ============================================================

$codes =
    @(
        $marketMatches |
        ForEach-Object {
            $_.Groups[1].Value
        }
    )

$duplicates =
    $codes |
    Group-Object |
    Where-Object {
        $_.Count -gt 1
    }

if ($duplicates) {
    $duplicateNames =
        (
            $duplicates |
            ForEach-Object {
                $_.Name
            }
        ) -join ", "

    throw "14.19 : countryCode duplique : $duplicateNames"
}

Write-Host ""
Write-Host "Marches KLYX detectes :" $marketMatches.Count

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.19 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.19 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.19 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.19 CHECK OK"
Write-Host "======================================"
Write-Host "90+ markets       : READY"
Write-Host "EUR               : READY"
Write-Host "USD               : READY"
Write-Host "Dollar currencies : READY"
Write-Host "Countries         : READY"
Write-Host "Territories       : READY"
Write-Host "Duplicate codes   : NONE"
Write-Host "Money formatter   : READY"
Write-Host "Payment currency  : READY"
Write-Host "Tests             : OK"
Write-Host "TypeScript        : OK"
Write-Host "Build             : OK"
Write-Host "======================================"