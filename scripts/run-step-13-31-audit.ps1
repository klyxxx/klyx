$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

$supabaseDir =
    Join-Path $root "supabase"

$migrationsDir =
    Join-Path $supabaseDir "migrations"

$reportsDir =
    Join-Path $root "reports"

$reportJson =
    Join-Path `
        $reportsDir `
        "supabase-migration-audit-13-31.json"

$reportTxt =
    Join-Path `
        $reportsDir `
        "supabase-migration-audit-13-31.txt"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $reportsDir |
    Out-Null

# KLYX_SUPABASE_MIGRATION_AUDIT_13_31A

$allSqlFiles =
    @(
        Get-ChildItem `
            -LiteralPath $root `
            -Recurse `
            -File `
            -Filter "*.sql" `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.next\\" -and
            $_.FullName -notmatch "\\scripts\\backups\\"
        }
    )

$activeMigrations =
    @(
        Get-ChildItem `
            -LiteralPath $migrationsDir `
            -File `
            -Filter "*.sql" `
            -ErrorAction SilentlyContinue
    )

$legacyMigrationDirs =
    @(
        Get-ChildItem `
            -LiteralPath $root `
            -Recurse `
            -Directory `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match "migration" -and
            $_.FullName -ne $migrationsDir -and
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.next\\" -and
            $_.FullName -notmatch "\\scripts\\backups\\"
        }
    )

$dispersedSql =
    @(
        $allSqlFiles |
        Where-Object {
            $_.DirectoryName -ne $migrationsDir
        }
    )

$activeEntries =
    @()

foreach (
    $file
    in $activeMigrations
) {
    $fileName =
        $file.Name

    $timestamp =
        ""

    $migrationName =
        $fileName

    $timestampMatch =
        [regex]::Match(
            $fileName,
            "^(\d{14})_(.+)\.sql$"
        )

    if (
        $timestampMatch.Success
    ) {
        $timestamp =
            $timestampMatch.Groups[1].Value

        $migrationName =
            $timestampMatch.Groups[2].Value
    }

    $content =
        [System.IO.File]::ReadAllText(
            $file.FullName
        )

    $activeEntries +=
        [pscustomobject]@{
            FileName =
                $fileName

            FullPath =
                $file.FullName

            Timestamp =
                $timestamp

            MigrationName =
                $migrationName

            Bytes =
                $file.Length

            Empty =
                [string]::IsNullOrWhiteSpace(
                    $content
                )

            CreateTableCount =
                (
                    [regex]::Matches(
                        $content,
                        "(?im)\bcreate\s+table\b"
                    )
                ).Count

            AlterTableCount =
                (
                    [regex]::Matches(
                        $content,
                        "(?im)\balter\s+table\b"
                    )
                ).Count

            CreateFunctionCount =
                (
                    [regex]::Matches(
                        $content,
                        "(?im)\bcreate\s+(or\s+replace\s+)?function\b"
                    )
                ).Count

            CreatePolicyCount =
                (
                    [regex]::Matches(
                        $content,
                        "(?im)\bcreate\s+policy\b"
                    )
                ).Count

            EnableRlsCount =
                (
                    [regex]::Matches(
                        $content,
                        "(?im)\benable\s+row\s+level\s+security\b"
                    )
                ).Count
        }
}

$duplicateTimestamps =
    @(
        $activeEntries |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace(
                $_.Timestamp
            )
        } |
        Group-Object Timestamp |
        Where-Object {
            $_.Count -gt 1
        }
    )

$sensitivePatterns =
    @(
        "profiles",
        "bookings",
        "services",
        "user_services",
        "service_profiles",
        "split_booking_batches",
        "split_booking_batch_items",
        "split_booking_price_confirmations",
        "split_booking_payment_confirmations",
        "split_booking_payment_runs",
        "split_booking_payment_units",
        "booking_financial_ledger",
        "stripe",
        "sumsub",
        "rls",
        "policy"
    )

$sensitiveHits =
    @()

foreach (
    $pattern
    in $sensitivePatterns
) {
    # IMPORTANT:
    # Ne jamais utiliser $matches ici.
    # $Matches est une variable automatique PowerShell.
    $hitFiles =
        @()

    foreach (
        $file
        in $allSqlFiles
    ) {
        $content =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )

        if (
            $content.IndexOf(
                $pattern,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -ge 0
        ) {
            $hitFiles +=
                $file.FullName
        }
    }

    $sensitiveHits +=
        [pscustomobject]@{
            Pattern =
                $pattern

            Count =
                $hitFiles.Count

            Files =
                @(
                    $hitFiles
                )
        }
}

$nonEmptyActiveCount =
    @(
        $activeEntries |
        Where-Object {
            -not $_.Empty
        }
    ).Count

$freshRebuildReady =
    (
        $dispersedSql.Count -eq 0 -and
        $duplicateTimestamps.Count -eq 0 -and
        $activeEntries.Count -gt 0 -and
        $nonEmptyActiveCount -eq
            $activeEntries.Count
    )

$report =
    [pscustomobject]@{
        Step =
            "13.31"

        Revision =
            "13.31a"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        Root =
            $root

        ActiveMigrationDirectory =
            $migrationsDir

        Counts =
            [pscustomobject]@{
                TotalSqlFiles =
                    $allSqlFiles.Count

                ActiveMigrations =
                    $activeMigrations.Count

                DispersedSqlFiles =
                    $dispersedSql.Count

                LegacyMigrationDirectories =
                    $legacyMigrationDirs.Count

                DuplicateActiveTimestamps =
                    $duplicateTimestamps.Count
            }

        ActiveMigrations =
            @(
                $activeEntries
            )

        DispersedSqlFiles =
            @(
                $dispersedSql |
                ForEach-Object {
                    $_.FullName
                }
            )

        LegacyMigrationDirectories =
            @(
                $legacyMigrationDirs |
                ForEach-Object {
                    $_.FullName
                }
            )

        DuplicateTimestamps =
            @(
                $duplicateTimestamps |
                ForEach-Object {
                    [pscustomobject]@{
                        Timestamp =
                            $_.Name

                        Files =
                            @(
                                $_.Group |
                                ForEach-Object {
                                    $_.FileName
                                }
                            )
                    }
                }
            )

        SensitiveSchemaCoverage =
            @(
                $sensitiveHits
            )

        FreshRebuildReady =
            $freshRebuildReady

        DestructiveChangesApplied =
            $false
    }

$json =
    $report |
    ConvertTo-Json -Depth 100

[System.IO.File]::WriteAllText(
    $reportJson,
    $json,
    $utf8
)

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add(
    "======================================"
)

$lines.Add(
    "KLYX 13.31 - SUPABASE MIGRATION AUDIT"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "SQL total : " +
    $allSqlFiles.Count
)

$lines.Add(
    "Migrations actives : " +
    $activeMigrations.Count
)

$lines.Add(
    "SQL disperses : " +
    $dispersedSql.Count
)

$lines.Add(
    "Dossiers migration legacy : " +
    $legacyMigrationDirs.Count
)

$lines.Add(
    "Timestamps dupliques : " +
    $duplicateTimestamps.Count
)

$lines.Add(
    ""
)

$lines.Add(
    "Fresh rebuild ready : " +
    $freshRebuildReady
)

$lines.Add(
    "Destructive changes : NON"
)

$lines.Add(
    ""
)

$lines.Add(
    "---- MIGRATIONS ACTIVES ----"
)

foreach (
    $entry
    in $activeEntries
) {
    $lines.Add(
        $entry.FileName +
        " | empty=" +
        $entry.Empty +
        " | tables=" +
        $entry.CreateTableCount +
        " | alters=" +
        $entry.AlterTableCount +
        " | functions=" +
        $entry.CreateFunctionCount +
        " | policies=" +
        $entry.CreatePolicyCount
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "---- SQL DISPERSES ----"
)

foreach (
    $file
    in $dispersedSql
) {
    $lines.Add(
        $file.FullName
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "---- DOSSIERS MIGRATION LEGACY ----"
)

foreach (
    $directory
    in $legacyMigrationDirs
) {
    $lines.Add(
        $directory.FullName
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "---- COUVERTURE STRUCTURES CRITIQUES ----"
)

foreach (
    $hit
    in $sensitiveHits
) {
    $lines.Add(
        $hit.Pattern +
        " : " +
        $hit.Count
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $reportTxt,
    $lines,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.31a AUDIT OK"
Write-Host "======================================"
Write-Host (
    "SQL total : " +
    $allSqlFiles.Count
)
Write-Host (
    "Migrations actives : " +
    $activeMigrations.Count
)
Write-Host (
    "SQL disperses : " +
    $dispersedSql.Count
)
Write-Host (
    "Legacy migration dirs : " +
    $legacyMigrationDirs.Count
)
Write-Host (
    "Duplicate timestamps : " +
    $duplicateTimestamps.Count
)
Write-Host (
    "Fresh rebuild ready : " +
    $freshRebuildReady
)
Write-Host "Production DB modified : NON"
Write-Host "SQL moved : NON"
Write-Host "SQL deleted : NON"
Write-Host "======================================"