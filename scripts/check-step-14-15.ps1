$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$catalog =
    Join-Path `
        $root `
        "lib\klyx-service-catalog.ts"

$migration =
    Join-Path `
        $root `
        "supabase\migrations\20260814225000_klyx_universal_service_catalog.sql"

if (-not (Test-Path -LiteralPath $catalog -PathType Leaf)) {
    throw "14.15 : catalogue introuvable."
}

if (-not (Test-Path -LiteralPath $migration -PathType Leaf)) {
    throw "14.15 : migration introuvable."
}

$catalogText =
    [System.IO.File]::ReadAllText(
        $catalog
    )

$sql =
    [System.IO.File]::ReadAllText(
        $migration
    )

foreach ($signal in @(
    "KLYX_UNIVERSAL_SERVICE_CATALOG_14_14",
    "KLYX_ANY_PROFESSION_ALLOWED",
    "Autre métier ou prestation"
)) {
    if (-not $catalogText.Contains($signal)) {
        throw "14.15 : catalogue incomplet : $signal"
    }
}

foreach ($signal in @(
    "KLYX_UNIVERSAL_SERVICE_DB_14_15",
    "KLYX_CUSTOM_SERVICE_FALLBACK_DB_14_15",
    "KLYX_ANY_PROFESSION_DB_READY_14_15",
    "insert into public.services",
    "on conflict (slug)",
    "Autre métier ou prestation",
    "baby-sitting",
    "menage-a-domicile",
    "demenagement",
    "bricolage-general",
    "plombier",
    "electricien",
    "developpeur-web",
    "photographe",
    "coiffeur",
    "jardinier",
    "mecanicien-automobile",
    "comptable",
    "chef-a-domicile",
    "agent-de-securite"
)) {
    if (-not $sql.Contains($signal)) {
        throw "14.15 : signal migration manquant : $signal"
    }
}

if (
    $sql -match
    '(?i)\b(delete|truncate|drop\s+table)\b'
) {
    throw "14.15 : SQL destructif interdit."
}

$insertRows =
    [regex]::Matches(
        $sql,
        "\('([^']|'')+',\s*'[^']+'\)"
    ).Count

if ($insertRows -lt 100) {
    throw "14.15 : moins de 100 services SQL detectes."
}

Write-Host ""
Write-Host "Catalogue..."
Write-Host "$insertRows services SQL detectes."

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.15 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.15 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.15 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.15 CHECK OK"
Write-Host "======================================"
Write-Host "Universal catalog  : READY"
Write-Host "100+ services      : READY"
Write-Host "Existing services  : PRESERVED"
Write-Host "Custom profession  : READY"
Write-Host "Idempotent SQL     : READY"
Write-Host "Destructive SQL    : NONE"
Write-Host "Tests              : OK"
Write-Host "TypeScript         : OK"
Write-Host "Build              : OK"
Write-Host "DB push            : NOT YET"
Write-Host "======================================"