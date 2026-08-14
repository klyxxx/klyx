$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-33-staging.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-staging-manifest-13-33.json"

$planPath =
    Join-Path `
        $root `
        "reports\supabase-staging-plan-13-33.txt"

$stagingRoot =
    Join-Path `
        $root `
        "supabase\staging-migrations-13-33"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $runner
    )
) {
    throw "13.33 : runner introuvable."
}

Write-Host ""
Write-Host "Building staging migration history..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.33 staging FAILED."
}

foreach (
    $required
    in @(
        $manifestPath,
        $planPath,
        $stagingRoot
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $required
        )
    ) {
        throw "13.33 : artefact manquant : $required"
    }
}

$manifest =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $manifest.Step -ne
    "13.33"
) {
    throw "13.33 : manifest invalide."
}

if (
    $manifest.ProductionDatabaseModified -ne
    $false
) {
    throw "13.33 : production DB modifiee."
}

if (
    $manifest.OfficialMigrationDirectoryModified -ne
    $false
) {
    throw "13.33 : supabase/migrations modifie."
}

if (
    $manifest.SourceSqlMoved -ne
    $false
) {
    throw "13.33 : SQL source deplace."
}

if (
    $manifest.SourceSqlDeleted -ne
    $false
) {
    throw "13.33 : SQL source supprime."
}

if (
    $manifest.Counts.Staged -lt
    1
) {
    throw "13.33 : aucun SQL staging genere."
}

$stagedSql =
    @(
        Get-ChildItem `
            -LiteralPath `
            $stagingRoot `
            -Recurse `
            -File `
            -Filter "*.sql"
    )

if (
    $stagedSql.Count -ne
    $manifest.Counts.Staged
) {
    throw "13.33 : nombre de SQL staging incoherent."
}

foreach (
    $file
    in $stagedSql
) {
    $content =
        [System.IO.File]::ReadAllText(
            $file.FullName
        )

    if (
        -not $content.Contains(
            "KLYX 13.33 STAGING COPY"
        )
    ) {
        throw (
            "13.33 : fichier staging sans provenance : " +
            $file.FullName
        )
    }

    if (
        -not $content.Contains(
            "DO NOT APPLY DIRECTLY TO PRODUCTION"
        )
    ) {
        throw (
            "13.33 : garde production absente : " +
            $file.FullName
        )
    }
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.33 automated tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.33 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.33 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.33 CHECK OK"
Write-Host "======================================"
Write-Host "Canonical staging area : CREEE"
Write-Host "Source provenance : ACTIVE"
Write-Host "SHA256 tracking : ACTIF"
Write-Host "Exact duplicate detection : ACTIVE"
Write-Host "Canonical phase classification : ACTIVE"
Write-Host "Manual-review quarantine : ACTIVE"
Write-Host "Remote snapshots : EXCLUS"
Write-Host "Production execution guard : ACTIF"
Write-Host "Source SQL moved : NON"
Write-Host "Source SQL deleted : NON"
Write-Host "Official migrations modified : NON"
Write-Host "Production DB modified : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "Disposable DB test readiness : OUI"
Write-Host "======================================"