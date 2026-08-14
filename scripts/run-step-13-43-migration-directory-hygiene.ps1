$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$migrationsDir =
    Join-Path `
        $root `
        "supabase\migrations"

$archiveRoot =
    Join-Path `
        $root `
        "supabase\migration-artifacts-archive-13-43"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-migration-hygiene-13-43.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-migration-hygiene-13-43.txt"

$historyPath =
    Join-Path `
        $root `
        "reports\supabase-migration-list-clean-13-43.txt"

$baselineName =
    "20260814000000_klyx_canonical_baseline.sql"

# ============================================================
# SAFETY
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $migrationsDir
    )
) {
    throw "13.43 : dossier supabase/migrations introuvable."
}

$baseline =
    Join-Path `
        $migrationsDir `
        $baselineName

if (
    -not (
        Test-Path `
            -LiteralPath `
            $baseline
    )
) {
    throw "13.43 : baseline canonique introuvable."
}

$officialSql =
    @(
        Get-ChildItem `
            -LiteralPath `
            $migrationsDir `
            -File `
            -Filter "*.sql"
    )

if (
    $officialSql.Count -ne 1
) {
    throw (
        "13.43 : migrations SQL officielles attendu=1, trouve=" +
        $officialSql.Count
    )
}

if (
    $officialSql[0].Name -ne
    $baselineName
) {
    throw "13.43 : migration officielle inattendue."
}

# ============================================================
# FIND BACKUP ARTIFACTS
# ============================================================

$backupArtifacts =
    @(
        Get-ChildItem `
            -LiteralPath `
            $migrationsDir `
            -File |
        Where-Object {
            $_.Name -match '\.sql\.bak'
        } |
        Sort-Object Name
    )

$inventory =
    @()

foreach (
    $file
    in $backupArtifacts
) {
    $inventory +=
        [pscustomobject]@{
            Name =
                $file.Name

            Length =
                $file.Length

            Sha256 =
                (
                    Get-FileHash `
                        -LiteralPath `
                        $file.FullName `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()
        }
}

# ============================================================
# ARCHIVE - NEVER DELETE
# ============================================================

if (
    $backupArtifacts.Count -gt 0
) {
    New-Item `
        -ItemType Directory `
        -Force `
        -Path $archiveRoot |
        Out-Null

    foreach (
        $file
        in $backupArtifacts
    ) {
        $destination =
            Join-Path `
                $archiveRoot `
                $file.Name

        if (
            Test-Path `
                -LiteralPath `
                $destination
        ) {
            $sourceHash =
                (
                    Get-FileHash `
                        -LiteralPath `
                        $file.FullName `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()

            $destinationHash =
                (
                    Get-FileHash `
                        -LiteralPath `
                        $destination `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()

            if (
                $sourceHash -ne
                $destinationHash
            ) {
                throw (
                    "13.43 : archive existante avec hash different : " +
                    $file.Name
                )
            }

            Remove-Item `
                -LiteralPath `
                $file.FullName `
                -Force
        }

        if (
            -not (
                Test-Path `
                    -LiteralPath `
                    $destination
            )
        ) {
            Move-Item `
                -LiteralPath `
                $file.FullName `
                -Destination `
                $destination
        }
    }
}

# ============================================================
# VERIFY ARCHIVE HASHES
# ============================================================

foreach (
    $entry
    in $inventory
) {
    $archived =
        Join-Path `
            $archiveRoot `
            $entry.Name

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $archived
        )
    ) {
        throw (
            "13.43 : archive manquante : " +
            $entry.Name
        )
    }

    $hash =
        (
            Get-FileHash `
                -LiteralPath `
                $archived `
                -Algorithm SHA256
        ).Hash.ToLowerInvariant()

    if (
        $hash -ne
        $entry.Sha256
    ) {
        throw (
            "13.43 : hash archive invalide : " +
            $entry.Name
        )
    }
}

# ============================================================
# VERIFY MIGRATIONS DIRECTORY
# ============================================================

$remainingArtifacts =
    @(
        Get-ChildItem `
            -LiteralPath `
            $migrationsDir `
            -File |
        Where-Object {
            $_.Name -match '\.sql\.bak'
        }
    )

if (
    $remainingArtifacts.Count -ne 0
) {
    throw "13.43 : artifacts .sql.bak encore presents."
}

$officialAfter =
    @(
        Get-ChildItem `
            -LiteralPath `
            $migrationsDir `
            -File `
            -Filter "*.sql"
    )

if (
    $officialAfter.Count -ne 1
) {
    throw "13.43 : historique SQL officiel invalide apres hygiene."
}

# ============================================================
# REMOTE LIST READ ONLY
# ============================================================

Write-Host ""
Write-Host "13.43 - Checking clean migration list..."
Write-Host ""

$historyOutput =
    @(
        cmd.exe /d /s /c `
            "npx.cmd supabase migration list --linked 2>&1"
    )

$historyExit =
    $LASTEXITCODE

foreach (
    $line
    in $historyOutput
) {
    Write-Host $line
}

if (
    $historyExit -ne 0
) {
    throw (
        "13.43 : migration list FAILED. ExitCode=" +
        $historyExit
    )
}

[System.IO.File]::WriteAllLines(
    $historyPath,
    @(
        $historyOutput |
        ForEach-Object {
            [string]$_
        }
    ),
    $utf8
)

$skipWarnings =
    @(
        $historyOutput |
        Where-Object {
            [string]$_ -match
            '(?i)Skipping migration.*file name must match pattern'
        }
    )

if (
    $skipWarnings.Count -gt 0
) {
    throw (
        "13.43 : warnings migration encore presents : " +
        $skipWarnings.Count
    )
}

# ============================================================
# VERIFY CANONICAL LOCAL + REMOTE
# ============================================================

$baselineRows =
    @(
        $historyOutput |
        Where-Object {
            [string]$_ -match
            '20260814000000'
        }
    )

if (
    $baselineRows.Count -lt 1
) {
    throw "13.43 : baseline canonique absente de migration list."
}

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.43"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        CanonicalBaseline =
            $baselineName

        OfficialSqlMigrationCount =
            $officialAfter.Count

        BackupArtifactsDetected =
            $inventory.Count

        BackupArtifactsArchived =
            $inventory.Count

        ArchivedArtifacts =
            $inventory

        ArchiveHashesVerified =
            $true

        BackupArtifactsRemaining =
            0

        MigrationListSkipWarnings =
            $skipWarnings.Count

        MigrationDirectoryClean =
            $true

        CanonicalHistoryStillVisible =
            $true

        ProductionDatabaseModified =
            $false

        ProductionSchemaModified =
            $false

        ProductionDataModified =
            $false

        LinkedReadUsed =
            $true

        LinkedWriteUsed =
            $false

        MigrationRepairExecuted =
            $false

        DbPushLinkedUsed =
            $false

        DbResetLinkedUsed =
            $false

        FilesDeleted =
            0

        HygieneComplete =
            $true
    }

[System.IO.File]::WriteAllText(
    $manifestPath,
    (
        $result |
        ConvertTo-Json -Depth 100
    ),
    $utf8
)

# ============================================================
# REPORT
# ============================================================

$report =
    @(
        "======================================",
        "KLYX 13.43 - MIGRATION DIRECTORY HYGIENE",
        "======================================",
        "",
        (
            "Backup artifacts detected : " +
            $inventory.Count
        ),
        (
            "Backup artifacts archived : " +
            $inventory.Count
        ),
        "Archive hashes : VERIFIED",
        "Files deleted : 0",
        "",
        "Official SQL migrations : 1",
        (
            "Canonical baseline : " +
            $baselineName
        ),
        "Migration-list skip warnings : 0",
        "",
        "Production DB modified : NON",
        "Production schema modified : NON",
        "Production data modified : NON",
        "Linked write : NON",
        "migration repair : NON",
        "db push --linked : NON",
        "db reset --linked : NON",
        "",
        "Migration directory clean : OUI",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.43 MIGRATION HYGIENE OK"
Write-Host "======================================"
Write-Host (
    "Backup artifacts archived : " +
    $inventory.Count
)
Write-Host "Archive hashes : VERIFIED"
Write-Host "Files deleted : 0"
Write-Host "Official migrations : 1"
Write-Host "Migration-list warnings : 0"
Write-Host "Canonical history : PRESERVED"
Write-Host "Production linked writes : NON"
Write-Host "======================================"