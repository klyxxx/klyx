$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$runner = Join-Path $root "scripts\run-step-13-36-canonical-cutover.ps1"
$manifestPath = Join-Path $root "reports\supabase-canonical-cutover-manifest-13-36.json"
$candidate = Join-Path $root "supabase\canonical-migrations-13-36\20260814000000_klyx_canonical_baseline.sql"
Write-Host ""
Write-Host "KLYX 13.36 canonical cutover preparation..."
Write-Host ""
if (-not (Test-Path -LiteralPath $runner)) { throw "13.36 : runner introuvable." }
powershell -ExecutionPolicy Bypass -File $runner
if ($LASTEXITCODE -ne 0) { throw "KLYX 13.36 runner FAILED." }
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "13.36 : manifest introuvable." }
if (-not (Test-Path -LiteralPath $candidate)) { throw "13.36 : baseline candidate introuvable." }
$data = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($data.Fidelity13_35Verified -ne $true) { throw "13.36 : fidelity 13.35 non valide." }
if ($data.CriticalTablesPresent -ne $true) { throw "13.36 : schema critique incomplet." }
if ($data.OfficialMigrationsUnchanged -ne $true) { throw "13.36 : migrations officielles alterees." }
if ($data.ProductionDatabaseModified -ne $false) { throw "13.36 : production modifiee." }
if ($data.LinkedWriteUsed -ne $false) { throw "13.36 : linked write interdit." }
if ([int]$data.FilesMoved -ne 0) { throw "13.36 : fichiers deplaces." }
if ([int]$data.FilesDeleted -ne 0) { throw "13.36 : fichiers supprimes." }
if ($data.CutoverExecuted -ne $false) { throw "13.36 : cutover execute trop tot." }
if ($data.ReadyForControlledCutover -ne $true) { throw "13.36 : cutover non pret." }
Write-Host ""
Write-Host "Automated tests..."
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "KLYX 13.36 automated tests FAILED." }
Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false
if ($LASTEXITCODE -ne 0) { throw "KLYX 13.36 TypeScript FAILED." }
Write-Host ""
Write-Host "Next build..."
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "KLYX 13.36 build FAILED." }
Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.36 CHECK OK"
Write-Host "======================================"
Write-Host "Canonical baseline candidate : READY"
Write-Host "Historical migrations : INVENTORIED"
Write-Host "Legacy migrations : INVENTORIED"
Write-Host "13.35 fidelity : VERIFIED"
Write-Host "Critical schema : PRESENT"
Write-Host "Official migrations modified : NON"
Write-Host "Files moved : 0"
Write-Host "Files deleted : 0"
Write-Host "Production linked writes : NON"
Write-Host "Cutover executed : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
