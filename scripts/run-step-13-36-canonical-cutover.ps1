$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = Split-Path -Parent $PSScriptRoot
$baseline = Join-Path $root "supabase\baseline-staging-13-34\20260814000000_klyx_public_baseline_13_34.sql"
$fidelityReport = Join-Path $root "reports\supabase-baseline-fidelity-13-35.json"
$officialMigrations = Join-Path $root "supabase\migrations"
$canonicalRoot = Join-Path $root "supabase\canonical-migrations-13-36"
$canonicalBaseline = Join-Path $canonicalRoot "20260814000000_klyx_canonical_baseline.sql"
$manifestPath = Join-Path $root "reports\supabase-canonical-cutover-manifest-13-36.json"
$planPath = Join-Path $root "reports\supabase-canonical-cutover-plan-13-36.txt"
foreach ($required in @($baseline,$fidelityReport,$officialMigrations)) {
    if (-not (Test-Path -LiteralPath $required)) { throw ("13.36 : requis introuvable : " + $required) }
}
$fidelity = Get-Content -LiteralPath $fidelityReport -Raw | ConvertFrom-Json
if ($fidelity.ObjectInventoriesEqual -ne $true) { throw "13.36 : fidelity 13.35 non valide." }
if ($fidelity.CriticalTablesPresent -ne $true) { throw "13.36 : tables critiques non validees." }
function Get-KlyxInventory {
    param([string]$Directory,[string]$Root)
    $items = @()
    if (-not (Test-Path -LiteralPath $Directory)) { return @() }
    $files = @(Get-ChildItem -LiteralPath $Directory -File -Filter "*.sql" -ErrorAction SilentlyContinue | Sort-Object FullName)
    foreach ($file in $files) {
        $items += [pscustomobject]@{
            Path = $file.FullName.Substring($Root.Length + 1)
            Sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            Length = $file.Length
        }
    }
    return @($items)
}
$officialBefore = @(Get-KlyxInventory -Directory $officialMigrations -Root $root)
$legacyFiles = @()
$legacyDirs = @(Get-ChildItem -LiteralPath (Join-Path $root "supabase") -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "migrations_legacy*" } | Sort-Object Name)
foreach ($dir in $legacyDirs) {
    $files = @(Get-ChildItem -LiteralPath $dir.FullName -Recurse -File -Filter "*.sql" -ErrorAction SilentlyContinue | Sort-Object FullName)
    foreach ($file in $files) {
        $legacyFiles += [pscustomobject]@{
            Path = $file.FullName.Substring($root.Length + 1)
            Sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            Length = $file.Length
        }
    }
}
if (Test-Path -LiteralPath $canonicalRoot) { Remove-Item -LiteralPath $canonicalRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $canonicalRoot | Out-Null
$baselineContent = [System.IO.File]::ReadAllText($baseline)
$headerLines = @(
"-- ============================================================",
"-- KLYX 13.36 CANONICAL MIGRATION CANDIDATE",
"-- Provenance: 13.34e baseline + 13.35 fidelity verification",
"-- STATUS: CANDIDATE ONLY",
"-- DO NOT APPLY TO LINKED PRODUCTION YET.",
"-- ============================================================",
""
)
$canonicalContent = (($headerLines -join "`r`n") + "`r`n" + $baselineContent)
[System.IO.File]::WriteAllText($canonicalBaseline,$canonicalContent,$utf8)
$criticalTables = @("profiles","services","service_profiles","user_services","bookings","booking_groups","split_booking_batches","split_booking_payment_runs","split_booking_payment_units")
$missingCritical = @()
foreach ($table in $criticalTables) {
    $pattern = '(?im)\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"public"\."' + [regex]::Escape($table) + '"'
    if (-not [regex]::IsMatch($canonicalContent,$pattern)) { $missingCritical += $table }
}
if ($missingCritical.Count -gt 0) { throw ("13.36 : tables critiques absentes : " + ($missingCritical -join ", ")) }
$officialAfter = @(Get-KlyxInventory -Directory $officialMigrations -Root $root)
$beforeJson = @($officialBefore) | ConvertTo-Json -Depth 20 -Compress
$afterJson = @($officialAfter) | ConvertTo-Json -Depth 20 -Compress
$officialUnchanged = ($beforeJson -eq $afterJson)
if (-not $officialUnchanged) { throw "13.36 : migrations officielles modifiees." }
$manifest = [pscustomobject]@{
    Step="13.36"; GeneratedAt=(Get-Date).ToString("o"); Strategy="verified_baseline_plus_future_incremental_migrations";
    CanonicalCandidateDirectory=$canonicalRoot.Substring($root.Length + 1);
    CanonicalCandidateBaseline=$canonicalBaseline.Substring($root.Length + 1);
    SourceBaseline=$baseline.Substring($root.Length + 1);
    SourceBaselineSha256=(Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash.ToLowerInvariant();
    CanonicalBaselineSha256=(Get-FileHash -LiteralPath $canonicalBaseline -Algorithm SHA256).Hash.ToLowerInvariant();
    Fidelity13_35Verified=$true; CriticalTablesPresent=$true;
    OfficialMigrationCount=@($officialBefore).Count; LegacyMigrationCount=@($legacyFiles).Count;
    OfficialMigrations=@($officialBefore); LegacyMigrations=@($legacyFiles);
    OfficialMigrationsUnchanged=$officialUnchanged; ProductionDatabaseModified=$false; LinkedWriteUsed=$false;
    FilesMoved=0; FilesDeleted=0; CutoverExecuted=$false; ReadyForControlledCutover=$true
}
[System.IO.File]::WriteAllText($manifestPath,($manifest | ConvertTo-Json -Depth 100),$utf8)
$plan = @(
"======================================",
"KLYX 13.36 - CANONICAL CUTOVER PLAN",
"======================================",
"",
"STATUS : PREPARATION ONLY",
("Candidate baseline : " + $canonicalBaseline.Substring($root.Length + 1)),
("Official migrations currently present : " + @($officialBefore).Count),
("Legacy migrations currently present : " + @($legacyFiles).Count),
"13.35 fidelity : VERIFIED",
("Official migrations unchanged : " + $officialUnchanged),
"Production DB modified : NON",
"Linked write used : NON",
"Files moved : 0",
"Files deleted : 0",
"Cutover executed : NON",
"======================================"
)
[System.IO.File]::WriteAllLines($planPath,$plan,$utf8)
Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.36 CUTOVER PREPARATION OK"
Write-Host "======================================"
Write-Host "Canonical baseline candidate : CREATED"
Write-Host ("Official migrations : " + @($officialBefore).Count)
Write-Host ("Legacy migrations : " + @($legacyFiles).Count)
Write-Host "Official migrations modified : NON"
Write-Host "Files moved : 0"
Write-Host "Files deleted : 0"
Write-Host "Production DB : NON TOUCHEE"
Write-Host "Linked write : NON"
Write-Host "Cutover executed : NON"
Write-Host "======================================"
