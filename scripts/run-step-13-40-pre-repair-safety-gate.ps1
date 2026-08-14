$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$plan13_39 =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-plan-13-39.json"

$commands13_39 =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-commands-13-39.txt"

$canonicalBaseline =
    Join-Path `
        $root `
        "supabase\migrations\20260814000000_klyx_canonical_baseline.sql"

$snapshotRoot =
    Join-Path `
        $root `
        "reports\13-40-pre-repair-snapshot"

$remoteSchema =
    Join-Path `
        $snapshotRoot `
        "remote-public-schema.sql"

$remoteHistory =
    Join-Path `
        $snapshotRoot `
        "remote-migration-history.txt"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-pre-repair-safety-13-40.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-pre-repair-safety-13-40.txt"

# ============================================================
# INPUT GATES
# ============================================================

foreach (
    $required
    in @(
        $plan13_39,
        $commands13_39,
        $canonicalBaseline
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
            "13.40 : requis introuvable : " +
            $required
        )
    }
}

$plan =
    Get-Content `
        -LiteralPath `
        $plan13_39 `
        -Raw |
    ConvertFrom-Json

if (
    $plan.RepairPlanOnly -ne
    $true
) {
    throw "13.40 : plan 13.39 non plan-only."
}

if (
    $plan.RepairPlanSafe -ne
    $true
) {
    throw "13.40 : plan 13.39 non sur."
}

if (
    @(
        $plan.UnknownRemoteVersions
    ).Count -gt 0
) {
    throw "13.40 : versions distantes inconnues."
}

if (
    $plan.MigrationRepairExecuted -ne
    $false
) {
    throw "13.40 : repair deja execute."
}

# ============================================================
# VALIDATE GENERATED COMMAND FILE
# ============================================================

$commandLines =
    @(
        Get-Content `
            -LiteralPath `
            $commands13_39
    )

$executableLines =
    @(
        $commandLines |
        ForEach-Object {
            $_.Trim()
        } |
        Where-Object {
            $_ -ne "" -and
            -not $_.StartsWith("#")
        }
    )

$invalidCommands =
    @()

foreach (
    $line
    in $executableLines
) {
    $valid =
        $false

    if (
        $line -match
        '^Set-Location\s+"C:\\Users\\fenjo\\Documents\\klyx"$'
    ) {
        $valid =
            $true
    }

    if (
        $line -match
        '^npx\.cmd supabase migration repair \d{14} --status (reverted|applied) --linked$'
    ) {
        $valid =
            $true
    }

    if (
        $line -eq
        "npx.cmd supabase migration list --linked"
    ) {
        $valid =
            $true
    }

    if (
        -not $valid
    ) {
        $invalidCommands +=
            $line
    }
}

if (
    $invalidCommands.Count -gt 0
) {
    throw (
        "13.40 : commandes inattendues dans plan 13.39 : " +
        (
            $invalidCommands -join " | "
        )
    )
}

$commandText =
    [System.IO.File]::ReadAllText(
        $commands13_39
    )

$forbiddenPatterns =
    @(
        'db\s+push',
        'db\s+reset',
        'db\s+diff',
        'DROP\s+TABLE',
        'ALTER\s+TABLE',
        'DELETE\s+FROM',
        'TRUNCATE',
        'INSERT\s+INTO',
        'UPDATE\s+'
    )

foreach (
    $pattern
    in $forbiddenPatterns
) {
    if (
        [regex]::IsMatch(
            $commandText,
            $pattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    ) {
        throw (
            "13.40 : operation interdite detectee dans le plan : " +
            $pattern
        )
    }
}

# ============================================================
# CLEAN SNAPSHOT DIRECTORY
# ============================================================

if (
    Test-Path `
        -LiteralPath `
        $snapshotRoot
) {
    Remove-Item `
        -LiteralPath `
        $snapshotRoot `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $snapshotRoot |
    Out-Null

# ============================================================
# READ-ONLY REMOTE SCHEMA SNAPSHOT
# ============================================================

Write-Host ""
Write-Host "Capturing remote public schema..."
Write-Host ""

cmd.exe /d /s /c `
    (
        'npx.cmd supabase db dump ' +
        '--linked ' +
        '--schema public ' +
        '--file "' +
        $remoteSchema +
        '" 2>&1'
    )

$schemaExit =
    $LASTEXITCODE

if (
    $schemaExit -ne 0
) {
    throw (
        "13.40 : remote schema dump FAILED. ExitCode=" +
        $schemaExit
    )
}

if (
    -not (
        Test-Path `
            -LiteralPath `
            $remoteSchema
    )
) {
    throw "13.40 : snapshot schema distant absent."
}

# ============================================================
# READ-ONLY REMOTE HISTORY SNAPSHOT
# ============================================================

Write-Host ""
Write-Host "Capturing remote migration history..."
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
        "13.40 : migration list FAILED. ExitCode=" +
        $historyExit
    )
}

[System.IO.File]::WriteAllLines(
    $remoteHistory,
    @(
        $historyOutput |
        ForEach-Object {
            [string]$_
        }
    ),
    $utf8
)

# ============================================================
# HASH EVERYTHING
# ============================================================

$remoteSchemaHash =
    (
        Get-FileHash `
            -LiteralPath `
            $remoteSchema `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$remoteHistoryHash =
    (
        Get-FileHash `
            -LiteralPath `
            $remoteHistory `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$canonicalHash =
    (
        Get-FileHash `
            -LiteralPath `
            $canonicalBaseline `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$planHash =
    (
        Get-FileHash `
            -LiteralPath `
            $plan13_39 `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$commandsHash =
    (
        Get-FileHash `
            -LiteralPath `
            $commands13_39 `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

# ============================================================
# CRITICAL TABLE CHECK
# ============================================================

$schemaSql =
    [System.IO.File]::ReadAllText(
        $remoteSchema
    )

$criticalTables =
    @(
        "profiles",
        "services",
        "service_profiles",
        "user_services",
        "bookings",
        "booking_groups",
        "split_booking_batches",
        "split_booking_payment_runs",
        "split_booking_payment_units"
    )

$missingCritical =
    @()

foreach (
    $table
    in $criticalTables
) {
    $pattern =
        '(?im)\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"public"\."' +
        [regex]::Escape(
            $table
        ) +
        '"'

    if (
        -not (
            [regex]::IsMatch(
                $schemaSql,
                $pattern
            )
        )
    ) {
        $missingCritical +=
            $table
    }
}

if (
    $missingCritical.Count -gt 0
) {
    throw (
        "13.40 : tables critiques absentes du snapshot distant : " +
        (
            $missingCritical -join ", "
        )
    )
}

# ============================================================
# VERIFY REMOTE HISTORY STILL MATCHES 13.39 INPUT
# ============================================================

$currentRemoteVersions =
    @()

foreach (
    $line
    in $historyOutput
) {
    $hits13_40 =
        [regex]::Matches(
            [string]$line,
            '(?<!\d)(\d{14})(?!\d)'
        )

    foreach (
        $hit13_40
        in $hits13_40
    ) {
        $version =
            $hit13_40.Groups[1].Value

        if (
            $version -notin
            $currentRemoteVersions
        ) {
            $currentRemoteVersions +=
                $version
        }
    }
}

$currentRemoteVersions =
    @(
        $currentRemoteVersions |
        Sort-Object -Unique
    )

$plannedRemoteVersions =
    @(
        $plan.RemoteRecordedVersions |
        ForEach-Object {
            [string]$_
        } |
        Sort-Object -Unique
    )

$currentJson =
    $currentRemoteVersions |
    ConvertTo-Json -Compress

$plannedJson =
    $plannedRemoteVersions |
    ConvertTo-Json -Compress

$historyUnchangedSincePlan =
    (
        $currentJson -eq
        $plannedJson
    )

if (
    -not $historyUnchangedSincePlan
) {
    throw (
        "13.40 : historique distant a change depuis 13.39. " +
        "Repair bloque."
    )
}

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.40"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        RemoteSchemaSnapshot =
            "reports\13-40-pre-repair-snapshot\remote-public-schema.sql"

        RemoteSchemaSha256 =
            $remoteSchemaHash

        RemoteHistorySnapshot =
            "reports\13-40-pre-repair-snapshot\remote-migration-history.txt"

        RemoteHistorySha256 =
            $remoteHistoryHash

        CanonicalBaselineSha256 =
            $canonicalHash

        RepairPlan13_39Sha256 =
            $planHash

        RepairCommands13_39Sha256 =
            $commandsHash

        RemoteRecordedVersions =
            $currentRemoteVersions

        RemoteHistoryUnchangedSince13_39 =
            $historyUnchangedSincePlan

        CriticalRemoteSchemaPresent =
            $true

        InvalidPlanCommands =
            $invalidCommands

        PlanCommandsWhitelisted =
            $true

        PreRepairSnapshotComplete =
            $true

        ReadyForMigrationHistoryRepair =
            $true

        ProductionDatabaseModified =
            $false

        ProductionSchemaModified =
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
        "KLYX 13.40 - FINAL PRE-REPAIR SAFETY GATE",
        "======================================",
        "",
        "Remote public schema snapshot : CREATED",
        (
            "Remote schema SHA256 : " +
            $remoteSchemaHash
        ),
        "",
        "Remote migration history snapshot : CREATED",
        (
            "Remote history SHA256 : " +
            $remoteHistoryHash
        ),
        "",
        (
            "Canonical baseline SHA256 : " +
            $canonicalHash
        ),
        (
            "13.39 plan SHA256 : " +
            $planHash
        ),
        (
            "13.39 commands SHA256 : " +
            $commandsHash
        ),
        "",
        "Critical remote schema : VERIFIED",
        "Plan commands whitelist : VERIFIED",
        (
            "Remote history unchanged since 13.39 : " +
            $historyUnchangedSincePlan
        ),
        "",
        "Production DB modified : NON",
        "Production schema modified : NON",
        "Linked write : NON",
        "migration repair executed : NON",
        "db push --linked : NON",
        "db reset --linked : NON",
        "",
        "Ready for migration history repair : OUI",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.40 SAFETY GATE OK"
Write-Host "======================================"
Write-Host "Remote schema snapshot : VERIFIED"
Write-Host "Remote history snapshot : VERIFIED"
Write-Host "Canonical baseline hash : CAPTURED"
Write-Host "Repair plan hash : CAPTURED"
Write-Host "Repair commands whitelist : VERIFIED"
Write-Host "Remote history unchanged : OUI"
Write-Host "Critical remote schema : VERIFIED"
Write-Host "migration repair executed : NON"
Write-Host "Production DB : NON TOUCHEE"
Write-Host "Production schema : NON TOUCHE"
Write-Host "Ready for repair : OUI"
Write-Host "======================================"