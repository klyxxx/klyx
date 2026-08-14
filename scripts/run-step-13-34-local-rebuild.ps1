$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

$stagingRoot =
    Join-Path `
        $root `
        "supabase\staging-migrations-13-33"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-staging-manifest-13-33.json"

$workRoot =
    Join-Path `
        $root `
        ".klyx-local-rebuild-13-34"

$workSupabase =
    Join-Path `
        $workRoot `
        "supabase"

$workMigrations =
    Join-Path `
        $workSupabase `
        "migrations"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-local-rebuild-13-34.txt"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-local-rebuild-13-34.json"

# KLYX_DISPOSABLE_LOCAL_REBUILD_13_34

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
    throw "13.34 : mauvais manifest source."
}

# ============================================================
# SAFETY GUARDS
# ============================================================

if (
    $env:SUPABASE_DB_URL
) {
    Write-Host "SUPABASE_DB_URL ignore volontairement."
}

if (
    $env:DATABASE_URL
) {
    Write-Host "DATABASE_URL ignore volontairement."
}

if (
    Test-Path `
        -LiteralPath `
        $workRoot
) {
    Remove-Item `
        -LiteralPath `
        $workRoot `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $workMigrations |
    Out-Null

# ============================================================
# CREATE ISOLATED SUPABASE PROJECT
# ============================================================

Push-Location $workRoot

try {
    npx.cmd supabase init

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "13.34 : supabase init FAILED."
    }
}
finally {
    Pop-Location
}

$configPath =
    Join-Path `
        $workSupabase `
        "config.toml"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $configPath
    )
) {
    throw "13.34 : config.toml local introuvable."
}

# ============================================================
# COPY STAGED SQL IN DETERMINISTIC ORDER
# ============================================================

$stagedEntries =
    @(
        $manifest.Entries |
        Where-Object {
            $_.Status -eq
            "staged"
        }
    )

if (
    $stagedEntries.Count -lt
    1
) {
    throw "13.34 : aucune migration staging."
}

# KLYX_SQL_DEPENDENCY_GRAPH_13_34C
#
# Le classement structurel seul ne suffit pas.
#
# Exemple:
#
# create table phone_verification_limits (
#   profile_id uuid references public.profiles(id)
# );
#
# doit attendre la migration qui crée public.profiles.
#
# Nous construisons donc un graphe de dépendances entre migrations
# à partir de CREATE TABLE, ALTER TABLE et REFERENCES public.*.

function Get-KlyxSqlTables {
    param(
        [string]$Sql
    )

    $created =
        New-Object System.Collections.Generic.List[string]

    $altered =
        New-Object System.Collections.Generic.List[string]

    $referenced =
        New-Object System.Collections.Generic.List[string]

    $createMatches =
        [regex]::Matches(
            $Sql,
            '(?im)\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?'
        )

    foreach (
        $match
        in $createMatches
    ) {
        $name =
            $match.Groups[1].Value.ToLowerInvariant()

        if (
            -not $created.Contains(
                $name
            )
        ) {
            $created.Add(
                $name
            )
        }
    }

    $alterMatches =
        [regex]::Matches(
            $Sql,
            '(?im)\balter\s+table\s+(?:if\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?'
        )

    foreach (
        $match
        in $alterMatches
    ) {
        $name =
            $match.Groups[1].Value.ToLowerInvariant()

        if (
            -not $altered.Contains(
                $name
            )
        ) {
            $altered.Add(
                $name
            )
        }
    }

    $referenceMatches =
        [regex]::Matches(
            $Sql,
            '(?im)\breferences\s+(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?'
        )

    foreach (
        $match
        in $referenceMatches
    ) {
        $name =
            $match.Groups[1].Value.ToLowerInvariant()

        if (
            -not $referenced.Contains(
                $name
            )
        ) {
            $referenced.Add(
                $name
            )
        }
    }

    return [pscustomobject]@{
        Created =
            @(
                $created
            )

        Altered =
            @(
                $altered
            )

        Referenced =
            @(
                $referenced
            )
    }
}

$nodes =
    @()

$nodePosition =
    0

foreach (
    $entry
    in $stagedEntries
) {
    $nodePosition +=
        1

    $sourcePath =
        [string]$entry.StagingPath

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $sourcePath
        )
    ) {
        throw (
            "13.34c : staging SQL introuvable : " +
            $sourcePath
        )
    }

    $sql =
        [System.IO.File]::ReadAllText(
            $sourcePath
        )

    $tables =
        Get-KlyxSqlTables `
            -Sql $sql

    $lower =
        $sql.ToLowerInvariant()

    $structuralRank =
        90

    if (
        $lower -match
        '\bcreate\s+extension\b'
    ) {
        $structuralRank =
            10
    }

    if (
        $structuralRank -eq 90 -and
        @(
            $tables.Created
        ).Count -gt 0
    ) {
        $structuralRank =
            20
    }

    if (
        $structuralRank -eq 90 -and
        @(
            $tables.Altered
        ).Count -gt 0
    ) {
        $structuralRank =
            30
    }

    if (
        $structuralRank -eq 90 -and
        $lower -match
        '\bcreate\s+(or\s+replace\s+)?function\b'
    ) {
        $structuralRank =
            40
    }

    if (
        $structuralRank -eq 90 -and
        $lower -match
        '\bcreate\s+(or\s+replace\s+)?trigger\b'
    ) {
        $structuralRank =
            50
    }

    if (
        $structuralRank -eq 90 -and
        (
            $lower -match
            '\bcreate\s+policy\b' -or
            $lower -match
            'row\s+level\s+security'
        )
    ) {
        $structuralRank =
            60
    }

    if (
        $structuralRank -eq 90 -and
        (
            $lower -match
            '\bgrant\b' -or
            $lower -match
            '\brevoke\b'
        )
    ) {
        $structuralRank =
            70
    }

    $originalPath =
        [string]$entry.SourcePath

    $originalName =
        [System.IO.Path]::GetFileName(
            $originalPath
        )

    $originalTimestamp =
        "99999999999999"

    $timestampMatch =
        [regex]::Match(
            $originalName,
            '^(\d{14})'
        )

    if (
        $timestampMatch.Success
    ) {
        $originalTimestamp =
            $timestampMatch.Groups[1].Value
    }

    $nodes +=
        [pscustomobject]@{
            Id =
                $nodePosition

            Entry =
                $entry

            Sql =
                $sql

            CreatedTables =
                @(
                    $tables.Created
                )

            AlteredTables =
                @(
                    $tables.Altered
                )

            ReferencedTables =
                @(
                    $tables.Referenced
                )

            StructuralRank =
                $structuralRank

            OriginalTimestamp =
                $originalTimestamp

            Phase =
                [string]$entry.Phase

            Path =
                $sourcePath

            Dependencies =
                New-Object System.Collections.Generic.List[int]
        }
}

# ============================================================
# TABLE -> MIGRATION CREATOR MAP
# ============================================================

$tableCreators =
    @{}

foreach (
    $node
    in $nodes
) {
    foreach (
        $table
        in @(
            $node.CreatedTables
        )
    ) {
        if (
            -not $tableCreators.ContainsKey(
                $table
            )
        ) {
            $tableCreators[$table] =
                New-Object System.Collections.Generic.List[int]
        }

        $tableCreators[$table].Add(
            [int]$node.Id
        )
    }
}

# ============================================================
# BUILD DEPENDENCIES
# ============================================================

foreach (
    $node
    in $nodes
) {
    $requiredTables =
        New-Object System.Collections.Generic.List[string]

    foreach (
        $table
        in @(
            $node.ReferencedTables
        )
    ) {
        if (
            -not $requiredTables.Contains(
                $table
            )
        ) {
            $requiredTables.Add(
                $table
            )
        }
    }

    foreach (
        $table
        in @(
            $node.AlteredTables
        )
    ) {
        if (
            -not $requiredTables.Contains(
                $table
            )
        ) {
            $requiredTables.Add(
                $table
            )
        }
    }

    foreach (
        $table
        in $requiredTables
    ) {
        if (
            -not $tableCreators.ContainsKey(
                $table
            )
        ) {
            continue
        }

        $creatorCandidates =
            @(
                $tableCreators[$table] |
                Where-Object {
                    $_ -ne
                    $node.Id
                }
            )

        if (
            $creatorCandidates.Count -lt
            1
        ) {
            continue
        }

        # Le premier CREATE de la table devient la dépendance canonique.
        $creatorId =
            [int]$creatorCandidates[0]

        if (
            -not $node.Dependencies.Contains(
                $creatorId
            )
        ) {
            $node.Dependencies.Add(
                $creatorId
            )
        }
    }
}

# ============================================================
# TOPOLOGICAL SORT
# ============================================================

$remaining =
    New-Object System.Collections.Generic.List[object]

foreach (
    $node
    in $nodes
) {
    $remaining.Add(
        $node
    )
}

$resolvedIds =
    New-Object System.Collections.Generic.HashSet[int]

$orderedNodes =
    New-Object System.Collections.Generic.List[object]

while (
    $remaining.Count -gt 0
) {
    $ready =
        @()

    foreach (
        $node
        in $remaining
    ) {
        $allDependenciesResolved =
            $true

        foreach (
            $dependencyId
            in $node.Dependencies
        ) {
            if (
                -not $resolvedIds.Contains(
                    [int]$dependencyId
                )
            ) {
                $allDependenciesResolved =
                    $false

                break
            }
        }

        if (
            $allDependenciesResolved
        ) {
            $ready +=
                $node
        }
    }

    if (
        $ready.Count -eq 0
    ) {
        Write-Host ""
        Write-Host "13.34c : cycle de dépendances SQL détecté."
        Write-Host ""

        foreach (
            $node
            in $remaining
        ) {
            Write-Host (
                "Node " +
                $node.Id +
                " | deps=" +
                (
                    @(
                        $node.Dependencies
                    ) -join ","
                ) +
                " | " +
                $node.Path
            )
        }

        throw "13.34c : cycle de dépendances SQL."
    }

    $selected =
        @(
            $ready |
            Sort-Object `
                StructuralRank,
                OriginalTimestamp,
                Phase,
                Path
        )[0]

    $orderedNodes.Add(
        $selected
    )

    [void]$resolvedIds.Add(
        [int]$selected.Id
    )

    [void]$remaining.Remove(
        $selected
    )
}

$orderedEntries =
    @(
        $orderedNodes |
        ForEach-Object {
            $_.Entry
        }
    )

# ============================================================
# DEPENDENCY DIAGNOSTICS
# ============================================================

Write-Host ""
Write-Host "KLYX SQL dependency graph:"
Write-Host ""

foreach (
    $node
    in $orderedNodes
) {
    $created =
        @(
            $node.CreatedTables
        ) -join ","

    $referenced =
        @(
            $node.ReferencedTables
        ) -join ","

    Write-Host (
        "rank=" +
        $node.StructuralRank +
        " | create=[" +
        $created +
        "] | refs=[" +
        $referenced +
        "] | " +
        (
            [System.IO.Path]::GetFileName(
                $node.Path
            )
        )
    )
}

Write-Host ""
$copyManifest =
    @()

$position =
    0

foreach (
    $entry
    in $orderedEntries
) {
    $source =
        [string]$entry.StagingPath

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $source
        )
    ) {
        throw (
            "13.34 : migration staging absente : " +
            $source
        )
    }

    $position +=
        1

    $phase =
        [string]$entry.Phase

    $safePhase =
        $phase `
            -replace '[^a-zA-Z0-9_]', '_'

    $sourceName =
        [System.IO.Path]::GetFileNameWithoutExtension(
            $source
        )

    $safeSource =
        $sourceName `
            -replace '[^a-zA-Z0-9_]', '_'

    $timestamp =
        (
            20260814000000 +
            $position
        ).ToString()

    $targetName =
        $timestamp +
        "_" +
        $safePhase +
        "_" +
        $safeSource +
        ".sql"

    $target =
        Join-Path `
            $workMigrations `
            $targetName

    $content =
        [System.IO.File]::ReadAllText(
            $source
        )

    [System.IO.File]::WriteAllText(
        $target,
        $content,
        $utf8
    )

    $copyManifest +=
        [pscustomobject]@{
            Position =
                $position

            Phase =
                $phase

            Source =
                $source

            Target =
                $target

            TargetName =
                $targetName
        }
}

# ============================================================
# DOCKER / LOCAL STACK CHECK
# ============================================================

$dockerAvailable =
    $false

try {
    docker version `
        --format "{{.Server.Version}}" `
        *> $null

    if (
        $LASTEXITCODE -eq 0
    ) {
        $dockerAvailable =
            $true
    }
}
catch {
    $dockerAvailable =
        $false
}

if (
    -not $dockerAvailable
) {
    $result =
        [pscustomobject]@{
            Step =
                "13.34"

            Status =
                "blocked_no_docker"

            DockerAvailable =
                $false

            LocalStackStarted =
                $false

            ResetSucceeded =
                $false

            MigrationCount =
                $copyManifest.Count

            FailedMigration =
                $null

            ProductionDatabaseModified =
                $false

            LinkedResetUsed =
                $false

            DbUrlUsed =
                $false

            WorkRoot =
                $workRoot
        }

    $json =
        $result |
        ConvertTo-Json -Depth 100

    [System.IO.File]::WriteAllText(
        $jsonPath,
        $json,
        $utf8
    )

    $text =
@"
======================================
KLYX 13.34 LOCAL REBUILD
======================================

Status : BLOCKED_NO_DOCKER
Docker available : NON
Local Supabase started : NON
Local DB reset : NON
Migrations prepared : $($copyManifest.Count)

Production DB modified : NON
--linked used : NON
--db-url used : NON

Action requise :
Installer/demarrer Docker Desktop puis relancer le checker.

======================================
"@

    [System.IO.File]::WriteAllText(
        $reportPath,
        $text,
        $utf8
    )

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX 13.34 BLOQUE PAR DOCKER"
    Write-Host "======================================"
    Write-Host "Migrations jetables : PREPAREES"
    Write-Host "Docker : INDISPONIBLE"
    Write-Host "Production DB : NON TOUCHEE"
    Write-Host "======================================"

    exit 20
}

# ============================================================
# START LOCAL STACK ONLY
# ============================================================

$startSucceeded =
    $false

$resetSucceeded =
    $false

$resetOutput =
    New-Object System.Collections.Generic.List[string]

Push-Location $workRoot

try {
    Write-Host ""
    Write-Host "Starting isolated local Supabase..."
    Write-Host ""

    # KLYX_SUPABASE_NATIVE_STDERR_FIX_13_34A
    #
    # Supabase/Docker write normal progress messages to stderr.
    # Windows PowerShell converts them to NativeCommandError when
    # ErrorActionPreference = Stop.
    #
    # cmd.exe merges stderr into stdout before PowerShell receives it.

    $startLines =
        @(
            cmd.exe /d /s /c `
                "npx.cmd supabase start 2>&1"
        )

    $startExitCode =
        $LASTEXITCODE

    foreach (
        $line
        in $startLines
    ) {
        Write-Host $line
    }

    if (
        $startExitCode -ne 0
    ) {
        throw (
            "13.34 : supabase start local FAILED. ExitCode=" +
            $startExitCode
        )
    }

    $startSucceeded =
        $true

    Write-Host ""
    Write-Host "Resetting isolated local database..."
    Write-Host ""

    # KLYX_SUPABASE_RESET_STDERR_FIX_13_34A

    $resetLines =
        @(
            cmd.exe /d /s /c `
                "npx.cmd supabase db reset --local --no-seed 2>&1"
        )

    $resetExitCode =
        $LASTEXITCODE

    foreach (
        $line
        in $resetLines
    ) {
        $resetOutput.Add(
            [string]$line
        )

        Write-Host $line
    }

    if (
        $resetExitCode -eq 0
    ) {
        $resetSucceeded =
            $true
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping isolated local Supabase..."
    Write-Host ""

    # KLYX_SUPABASE_STOP_STDERR_FIX_13_34A
    cmd.exe /d /s /c `
        "npx.cmd supabase stop --no-backup >nul 2>&1" |
        Out-Null

    Pop-Location
}

# ============================================================
# FAILURE DIAGNOSTICS
# ============================================================

$failedMigration =
    $null

if (
    -not $resetSucceeded
) {
    foreach (
        $line
        in $resetOutput
    ) {
        $match =
            [regex]::Match(
                $line,
                '(\d{14}_[^\s]+\.sql)'
            )

        if (
            $match.Success
        ) {
            $failedMigration =
                $match.Groups[1].Value

            break
        }
    }
}

$status =
    if (
        $resetSucceeded
    ) {
        "success"
    }
    else {
        "migration_failure"
    }

$result =
    [pscustomobject]@{
        Step =
            "13.34"

        Status =
            $status

        DockerAvailable =
            $dockerAvailable

        LocalStackStarted =
            $startSucceeded

        ResetSucceeded =
            $resetSucceeded

        MigrationCount =
            $copyManifest.Count

        FailedMigration =
            $failedMigration

        MigrationOrder =
            $copyManifest

        ResetOutput =
            @(
                $resetOutput
            )

        ProductionDatabaseModified =
            $false

        LinkedResetUsed =
            $false

        DbUrlUsed =
            $false

        WorkRoot =
            $workRoot
    }

$json =
    $result |
    ConvertTo-Json -Depth 100

[System.IO.File]::WriteAllText(
    $jsonPath,
    $json,
    $utf8
)

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add(
    "======================================"
)

$lines.Add(
    "KLYX 13.34 - DISPOSABLE LOCAL REBUILD"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "Status : " +
    $status
)

$lines.Add(
    "Docker available : " +
    $dockerAvailable
)

$lines.Add(
    "Local stack started : " +
    $startSucceeded
)

$lines.Add(
    "Local db reset succeeded : " +
    $resetSucceeded
)

$lines.Add(
    "Migration count : " +
    $copyManifest.Count
)

$lines.Add(
    "Failed migration : " +
    $failedMigration
)

$lines.Add(
    ""
)

$lines.Add(
    "Production database modified : NON"
)

$lines.Add(
    "--linked used : NON"
)

$lines.Add(
    "--db-url used : NON"
)

$lines.Add(
    ""
)

$lines.Add(
    "---- ORDER ----"
)

foreach (
    $item
    in $copyManifest
) {
    $lines.Add(
        (
            "{0:D4} | {1} | {2}" -f
            $item.Position,
            $item.Phase,
            $item.TargetName
        )
    )
}

if (
    -not $resetSucceeded
) {
    $lines.Add(
        ""
    )

    $lines.Add(
        "---- RESET OUTPUT ----"
    )

    foreach (
        $line
        in $resetOutput
    ) {
        $lines.Add(
            $line
        )
    }
}

$lines.Add(
    ""
)

$lines.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $reportPath,
    $lines,
    $utf8
)

if (
    -not $resetSucceeded
) {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX 13.34 MIGRATION FAILURE DETECTED"
    Write-Host "======================================"
    Write-Host (
        "Failed migration : " +
        $failedMigration
    )
    Write-Host "Production DB : NON TOUCHEE"
    Write-Host "======================================"

    exit 30
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.34 LOCAL REBUILD OK"
Write-Host "======================================"
Write-Host (
    "Migrations replayed : " +
    $copyManifest.Count
)
Write-Host "Fresh local database : OK"
Write-Host "Production DB : NON TOUCHEE"
Write-Host "--linked : NON"
Write-Host "--db-url : NON"
Write-Host "======================================"