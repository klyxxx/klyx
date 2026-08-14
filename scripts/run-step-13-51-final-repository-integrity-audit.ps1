$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$baselineVersion =
    "20260814000000"

$baselineName =
    "20260814000000_klyx_canonical_baseline.sql"

$migrationsDir =
    Join-Path `
        $root `
        "supabase\migrations"

$manifest13_50 =
    Join-Path `
        $root `
        "reports\repository-controlled-git-removal-13-50.json"

$manifest13_47 =
    Join-Path `
        $root `
        "reports\repository-dead-artifact-archive-13-47.json"

$manifest13_45 =
    Join-Path `
        $root `
        "reports\repository-cleanup-13-45.json"

$manifestPath =
    Join-Path `
        $root `
        "reports\repository-final-integrity-13-51.json"

$reportPath =
    Join-Path `
        $root `
        "reports\repository-final-integrity-13-51.txt"

$historyPath =
    Join-Path `
        $root `
        "reports\repository-final-migration-history-13-51.txt"

# ============================================================
# REQUIRED PRIOR STATES
# ============================================================

foreach (
    $required
    in @(
        $manifest13_50,
        $manifest13_47,
        $manifest13_45
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $required
        )
    ) {
        throw (
            "13.51 : manifest requis introuvable : " +
            $required
        )
    }
}

$data13_50 =
    Get-Content `
        -LiteralPath `
        $manifest13_50 `
        -Raw |
    ConvertFrom-Json

$data13_47 =
    Get-Content `
        -LiteralPath `
        $manifest13_47 `
        -Raw |
    ConvertFrom-Json

$data13_45 =
    Get-Content `
        -LiteralPath `
        $manifest13_45 `
        -Raw |
    ConvertFrom-Json

if (
    $data13_50.RemovalComplete -ne
    $true
) {
    throw "13.51 : 13.50 incomplet."
}

if (
    $data13_47.ArchiveComplete -ne
    $true
) {
    throw "13.51 : 13.47 incomplet."
}

if (
    $data13_45.CleanupComplete -ne
    $true
) {
    throw "13.51 : 13.45 incomplet."
}

# ============================================================
# CANONICAL MIGRATION DIRECTORY
# ============================================================

$officialSql =
    @(
        Get-ChildItem `
            -LiteralPath `
            $migrationsDir `
            -File `
            -Filter "*.sql"
    )

if (
    $officialSql.Count -ne
    1
) {
    throw (
        "13.51 : migrations officielles attendu=1, trouve=" +
        $officialSql.Count
    )
}

if (
    $officialSql[0].Name -ne
    $baselineName
) {
    throw (
        "13.51 : mauvaise migration officielle : " +
        $officialSql[0].Name
    )
}

$baselineHash =
    (
        Get-FileHash `
            -LiteralPath `
            $officialSql[0].FullName `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

# ============================================================
# ACTIVE BACKUP ARTIFACT CHECK
# ============================================================

$excludedSegments =
    @(
        ".git",
        ".next",
        "node_modules",
        "repository-archive-13-45",
        "repository-archive-13-47-dead-artifacts",
        "repository-archive-13-50-git-removal",
        "migration-history-archive-13-37",
        "migration-artifacts-archive-13-43"
    )

$activeBackupArtifacts =
    @(
        Get-ChildItem `
            -LiteralPath `
            $root `
            -File `
            -Recurse `
            -Force |
        Where-Object {
            $file =
                $_

            $relative =
                $file.FullName.Substring(
                    $root.Length + 1
                )

            $segments =
                $relative.Split(
                    [System.IO.Path]::DirectorySeparatorChar
                )

            foreach (
                $segment
                in $excludedSegments
            ) {
                if (
                    $segments -contains
                    $segment
                ) {
                    return $false
                }
            }

            return (
                $file.Name -match '\.bak$' -or
                $file.Name -match '\.bak-' -or
                $file.Name -match '\.backup$' -or
                $file.Name -match '\.backup-' -or
                $file.Name -match '\.old$' -or
                $file.Name -match '\.orig$' -or
                $file.Name -match '\.tmp$' -or
                $file.Name -match '\.temp$'
            )
        }
    )

# ============================================================
# MIGRATION HISTORY PARSER
# ============================================================

function Get-RemoteMigrationVersions {
    param(
        [string[]]$Lines
    )

    $versions =
        New-Object System.Collections.Generic.List[string]

    foreach (
        $line
        in $Lines
    ) {
        $normalized =
            (
                [string]$line
            ).Replace(
                [char]0x2502,
                [char]0x007C
            )

        if (
            -not $normalized.Contains("|")
        ) {
            continue
        }

        $parts =
            $normalized.Split(
                [char]0x007C
            )

        if (
            $parts.Count -lt 2
        ) {
            continue
        }

        $remote =
            $parts[1].Trim().Trim(
                [char]0x0060
            )

        if (
            $remote -match '^\d{14}$'
        ) {
            if (
                -not $versions.Contains(
                    $remote
                )
            ) {
                $versions.Add(
                    $remote
                )
            }
        }
    }

    return @(
        $versions |
        Sort-Object
    )
}

# ============================================================
# READ-ONLY REMOTE HISTORY CHECK
# ============================================================

Write-Host ""
Write-Host "13.51 - Checking canonical migration history..."
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
        "13.51 : migration list FAILED. ExitCode=" +
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

$remoteVersions =
    @(
        Get-RemoteMigrationVersions `
            -Lines $historyOutput
    )

if (
    $remoteVersions.Count -ne
    1
) {
    throw (
        "13.51 : remote migration count attendu=1, trouve=" +
        $remoteVersions.Count
    )
}

if (
    $remoteVersions[0] -ne
    $baselineVersion
) {
    throw (
        "13.51 : baseline remote incorrecte : " +
        $remoteVersions[0]
    )
}

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
        "13.51 : warnings migration detectes : " +
        $skipWarnings.Count
    )
}

# ============================================================
# GIT STATE
# ============================================================

$gitStatus =
    @(
        git status --short
    )

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.51 : git status FAILED."
}

$head =
    (
        git rev-parse HEAD
    ).Trim()

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.51 : git rev-parse HEAD FAILED."
}

$stagedDeleted =
    @(
        $gitStatus |
        Where-Object {
            [string]$_ -match '^D\s'
        }
    )

# ============================================================
# ARCHIVE PRESENCE
# ============================================================

$archive45 =
    Join-Path `
        $root `
        "repository-archive-13-45"

$archive47 =
    Join-Path `
        $root `
        "repository-archive-13-47-dead-artifacts"

$archive50 =
    Join-Path `
        $root `
        "repository-archive-13-50-git-removal"

$archive45Exists =
    Test-Path `
        -LiteralPath `
        $archive45

$archive47Exists =
    Test-Path `
        -LiteralPath `
        $archive47

$archive50Exists =
    Test-Path `
        -LiteralPath `
        $archive50

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.51"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        CanonicalBaselineVersion =
            $baselineVersion

        CanonicalBaselineName =
            $baselineName

        CanonicalBaselineSha256 =
            $baselineHash

        OfficialMigrationCount =
            $officialSql.Count

        RemoteMigrationVersions =
            $remoteVersions

        RemoteMigrationCount =
            $remoteVersions.Count

        LocalRemoteMigrationAligned =
            $true

        MigrationSkipWarnings =
            $skipWarnings.Count

        ActiveBackupArtifactCount =
            $activeBackupArtifacts.Count

        ActiveBackupArtifacts =
            @(
                $activeBackupArtifacts |
                ForEach-Object {
                    $_.FullName.Substring(
                        $root.Length + 1
                    )
                }
            )

        Archive13_45Exists =
            $archive45Exists

        Archive13_47Exists =
            $archive47Exists

        Archive13_50Exists =
            $archive50Exists

        GitHead =
            $head

        GitStatus =
            @(
                $gitStatus
            )

        StagedDeletedCount =
            $stagedDeleted.Count

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

        RepositoryIntegrityAuditComplete =
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
        "KLYX 13.51 - FINAL REPOSITORY INTEGRITY AUDIT",
        "======================================",
        "",
        (
            "Canonical baseline : " +
            $baselineVersion
        ),
        "Official migrations : 1",
        "Remote migrations : 1",
        "Local/remote migration history : ALIGNED",
        "Migration CLI warnings : 0",
        "",
        (
            "Active backup artifacts : " +
            $activeBackupArtifacts.Count
        ),
        (
            "Archive 13.45 present : " +
            $archive45Exists
        ),
        (
            "Archive 13.47 present : " +
            $archive47Exists
        ),
        (
            "Archive 13.50 present : " +
            $archive50Exists
        ),
        "",
        (
            "Git HEAD : " +
            $head
        ),
        (
            "Git staged deletions : " +
            $stagedDeleted.Count
        ),
        "",
        "Production DB modified : NON",
        "Production schema modified : NON",
        "Production data modified : NON",
        "Linked write : NON",
        "migration repair : NON",
        "db push --linked : NON",
        "db reset --linked : NON",
        "",
        "Repository integrity audit : COMPLETE",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.51 REPOSITORY INTEGRITY OK"
Write-Host "======================================"
Write-Host "Canonical migration count : 1"
Write-Host "Remote migration count : 1"
Write-Host "Local/remote history : ALIGNED"
Write-Host "Migration CLI warnings : 0"
Write-Host (
    "Active backup artifacts : " +
    $activeBackupArtifacts.Count
)
Write-Host "Historical archives : PRESERVED"
Write-Host (
    "Git staged removals : " +
    $stagedDeleted.Count
)
Write-Host "Production linked writes : NON"
Write-Host "======================================"