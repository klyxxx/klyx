$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$sqlPath =
    Join-Path `
        $root `
        "supabase\KLYX_14_16_APPLY_UNIVERSAL_SERVICES.sql"

if (-not (Test-Path -LiteralPath $sqlPath -PathType Leaf)) {
    throw "14.16 : SQL autonome introuvable."
}

$sql =
    [System.IO.File]::ReadAllText(
        $sqlPath
    )

foreach ($signal in @(
    "KLYX_UNIVERSAL_SAFE_APPLY_14_16",
    "KLYX_UNIVERSAL_CATALOG_VERIFY_14_16",
    "insert into public.services",
    "where not exists",
    "total_services_klyx",
    "baby-sitting",
    "menage-a-domicile",
    "demenagement",
    "plombier",
    "electricien",
    "developpeur-web",
    "photographe",
    "comptable",
    "autre-metier-ou-prestation"
)) {
    if (-not $sql.Contains($signal)) {
        throw "14.16 : signal manquant : $signal"
    }
}

# KLYX_SQL_COMMENT_SAFE_SCAN_14_16B
$executableSql =
    [regex]::Replace(
        $sql,
        '(?m)--.*$',
        ""
    )

foreach ($forbidden in @(
    "\bdelete\s+from\b",
    "\bupdate\s+public\.services\b",
    "\btruncate\b",
    "\bdrop\s+table\b",
    "\balter\s+table\b"
)) {
    if (
        $executableSql -match
        "(?i)$forbidden"
    ) {
        throw "14.16 : SQL executable interdit detecte : $forbidden"
    }
}

$insertCount =
    [regex]::Matches(
        $executableSql,
        "insert into public\.services"
    ).Count

if ($insertCount -lt 100) {
    throw "14.16 : moins de 100 insertions detectees."
}

Write-Host ""
Write-Host "$insertCount services universels prets."

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.16 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.16 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.16 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.16 CHECK OK"
Write-Host "======================================"
Write-Host "Universal SQL        : READY"
Write-Host "100+ professions     : READY"
Write-Host "Existing data        : PRESERVED"
Write-Host "Missing only         : INSERT"
Write-Host "Comment false alerts : FIXED"
Write-Host "Destructive SQL      : NONE"
Write-Host "Tests                : OK"
Write-Host "TypeScript           : OK"
Write-Host "Build                : OK"
Write-Host "======================================"