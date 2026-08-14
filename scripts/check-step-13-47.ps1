$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-47-dead-artifact-archive.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-dead-artifact-archive-13-47.json"

Write-Host ""
Write-Host "KLYX 13.47 controlled dead artifact archive..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.47 runner FAILED."
}

if (
    -not (
        Test-Path `
            -LiteralPath `
            $manifestPath
    )
) {
    throw "13.47 : manifest introuvable."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.ArchiveComplete -ne
    $true
) {
    throw "13.47 : archivage incomplet."
}

if (
    $data.CleanupReversible -ne
    $true
) {
    throw "13.47 : cleanup non reversible."
}

if (
    $data.ArchiveHashesVerified -ne
    $true
) {
    throw "13.47 : hashes archive invalides."
}

if (
    [int]$data.OriginalDeadSourcesRemaining -ne
    0
) {
    throw "13.47 : dead artifacts encore presents."
}

if (
    $data.ProtectedFilesPreserved -ne
    $true
) {
    throw "13.47 : fichiers proteges affectes."
}

if (
    $data.CanonicalMigrationPreserved -ne
    $true
) {
    throw "13.47 : migration canonique affectee."
}

if (
    [int]$data.FilesIrreversiblyDeleted -ne
    0
) {
    throw "13.47 : suppression irreversible."
}

if (
    [int]$data.SourceFilesEdited -ne
    0
) {
    throw "13.47 : sources modifiees."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.47 : production modifiee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.47 : linked write interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.47 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.47 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.47 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.47 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Dead candidates archived : " +
    $data.ArchivedCount
)
Write-Host "Used files : PRESERVED"
Write-Host "Tracked unreferenced files : PRESERVED"
Write-Host "Archive hashes : VERIFIED"
Write-Host "Canonical migration : PRESERVED"
Write-Host "Irreversible deletions : 0"
Write-Host "Production linked writes : NON"
Write-Host "Cleanup reversible : OUI"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"