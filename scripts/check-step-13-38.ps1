$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-38-remote-history-audit.ps1"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-remote-history-audit-13-38.json"

Write-Host ""
Write-Host "KLYX 13.38 remote migration history audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.38 runner FAILED."
}

if (
    -not (
        Test-Path `
            -LiteralPath `
            $jsonPath
    )
) {
    throw "13.38 : rapport JSON introuvable."
}

$data =
    Get-Content `
        -LiteralPath `
        $jsonPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.AuditCompleted -ne
    $true
) {
    throw "13.38 : audit incomplet."
}

if (
    [int]$data.LocalCanonicalCount -ne
    1
) {
    throw "13.38 : historique local canonique invalide."
}

if (
    [int]$data.ArchivedPreviousCount -lt
    1
) {
    throw "13.38 : archive historique vide."
}

if (
    [int]$data.RemoteRecordedCount -lt
    1
) {
    throw "13.38 : historique distant vide."
}

if (
    $data.ProductionDatabaseModified -ne
    $false
) {
    throw "13.38 : production modifiee."
}

if (
    $data.LinkedReadUsed -ne
    $true
) {
    throw "13.38 : lecture distante non executee."
}

if (
    $data.LinkedWriteUsed -ne
    $false
) {
    throw "13.38 : linked write interdit."
}

if (
    $data.MigrationRepairUsed -ne
    $false
) {
    throw "13.38 : migration repair interdit."
}

if (
    $data.DbPushLinkedUsed -ne
    $false
) {
    throw "13.38 : db push linked interdit."
}

if (
    $data.DbResetLinkedUsed -ne
    $false
) {
    throw "13.38 : db reset linked interdit."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.38 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.38 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.38 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.38 CHECK OK"
Write-Host "======================================"
Write-Host "Remote migration history : CAPTURED"
Write-Host "Canonical local history : CAPTURED"
Write-Host "Archived previous history : CAPTURED"
Write-Host (
    "Remote canonical alignment : " +
    $data.RemoteMatchesCanonicalHistory
)
Write-Host (
    "History cutover required : " +
    $data.HistoryCutoverRequired
)
Write-Host "Production linked writes : NON"
Write-Host "migration repair : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"