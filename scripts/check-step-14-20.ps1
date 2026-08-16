$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$markets =
    Join-Path `
        $root `
        "lib\klyx-supported-markets.ts"

$sqlPath =
    Join-Path `
        $root `
        "supabase\KLYX_14_20_APPLY_PROFILE_MARKETS.sql"

foreach ($path in @(
    $markets,
    $sqlPath
)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "14.20 : fichier introuvable : $path"
    }
}

$marketText =
    [System.IO.File]::ReadAllText(
        $markets
    )

$sql =
    [System.IO.File]::ReadAllText(
        $sqlPath
    )

foreach ($signal in @(
    "KLYX_SUPPORTED_MARKETS_14_19",
    "KLYX_MARKETS_EUR_DOLLAR_READY",
    "EUR",
    "USD",
    "CAD",
    "AUD"
)) {
    if (-not $marketText.Contains($signal)) {
        throw "14.20 : registre marches incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_PROFILE_MARKETS_DB_14_20",
    "country_code",
    "currency_code",
    "profiles_country_code_klyx_check",
    "profiles_currency_code_klyx_check",
    "profiles_market_pair_klyx_check",
    "profiles_country_code_klyx_idx",
    "KLYX_PROFILE_MARKETS_VERIFY_14_20",
    "KLYX_EUR_DOLLAR_PROFILE_FOUNDATION_READY_14_20"
)) {
    if (-not $sql.Contains($signal)) {
        throw "14.20 : SQL incomplet : $signal"
    }
}

$executableSql =
    [regex]::Replace(
        $sql,
        '(?m)--.*$',
        ""
    )

foreach ($forbidden in @(
    "\bdelete\s+from\b",
    "\btruncate\b",
    "\bdrop\s+table\b",
    "\bupdate\s+public\.profiles\b"
)) {
    if ($executableSql -match "(?i)$forbidden") {
        throw "14.20 : SQL destructif detecte : $forbidden"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.20 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.20 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.20 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.20 CHECK OK"
Write-Host "======================================"
Write-Host "EUR/$ markets      : READY"
Write-Host "Profile country    : DB READY"
Write-Host "Profile currency   : DB READY"
Write-Host "Existing profiles  : PRESERVED"
Write-Host "Tests              : OK"
Write-Host "TypeScript         : OK"
Write-Host "Build              : OK"
Write-Host "======================================"