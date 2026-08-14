$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-45-controlled-repository-cleanup.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-cleanup-13-45.json"

Write-Host ""
Write-Host "KLYX 13.45 controlled repository cleanup..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.45 runner FAILED."
}

if (
    -not (
        Test-Path `
            -LiteralPath `
            $manifestPath
    )
) {
    throw "13.45 : manifest introuvable."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.CleanupComplete -ne
    $true
) {
    throw "13.45 : cleanup incomplet."
}

if (
    $data.CleanupReversible -ne
    $true
) {
    throw "13.45 : nettoyage non reversible."
}

if (
    $data.ArchiveHashesVerified -ne
    $true
) {
    throw "13.45 : hashes archive invalides."
}

if (
    [int]$data.OriginalMovedSourcesRemaining -ne
    0
) {
    throw "13.45 : sources archivees encore presentes."
}

if (
    $data.CanonicalMigrationPreserved -ne
    $true
) {
    throw "13.45 : migration canonique affectee."
}

if (
    [int]$data.FilesIrreversiblyDeleted -ne
    0
) {
    throw "13.45 : suppression irreversible detectee."
}

if (
    [int]$data.SourceFilesEdited -ne
    0
) {
    throw "13.45 : source applicative modifiee."
}

if (
    [int]$data.GenericArtifactsMoved -ne
    0
) {
    throw "13.45 : artifacts generiques deplaces sans validation."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.45 : production DB modifiee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.45 : linked write interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.45 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.45 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.45 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.45 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Backup files archived : " +
    $data.BackupFilesMoved
)
Write-Host (
    "Temporary directories archived : " +
    $data.TemporaryDirectoriesMoved
)
Write-Host (
    "Generic artifacts review-only : " +
    @(
        $data.GenericArtifactReviewOnly
    ).Count
)
Write-Host "Archive hashes : VERIFIED"
Write-Host "Canonical migration : PRESERVED"
Write-Host "Irreversible deletions : 0"
Write-Host "Production linked writes : NON"
Write-Host "Cleanup reversible : OUI"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"