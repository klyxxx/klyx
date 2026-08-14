$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$audit13_38 =
    Join-Path `
        $root `
        "reports\supabase-remote-history-audit-13-38.json"

$cutover13_37 =
    Join-Path `
        $root `
        "reports\supabase-controlled-cutover-manifest-13-37.json"

$planJson =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-plan-13-39.json"

$planText =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-plan-13-39.txt"

$commandFile =
    Join-Path `
        $root `
        "reports\supabase-migration-repair-commands-13-39.txt"

# ============================================================
# INPUT SAFETY
# ============================================================

foreach (
    $required
    in @(
        $audit13_38,
        $cutover13_37
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
            "13.39 : requis introuvable : " +
            $required
        )
    }
}

$audit =
    Get-Content `
        -LiteralPath `
        $audit13_38 `
        -Raw |
    ConvertFrom-Json

$cutover =
    Get-Content `
        -LiteralPath `
        $cutover13_37 `
        -Raw |
    ConvertFrom-Json

if (
    $audit.AuditCompleted -ne
    $true
) {
    throw "13.39 : audit 13.38 incomplet."
}

if (
    $audit.ProductionDatabaseModified -ne
    $false
) {
    throw "13.39 : etat production 13.38 invalide."
}

if (
    $audit.LinkedWriteUsed -ne
    $false
) {
    throw "13.39 : linked write detecte en 13.38."
}

if (
    $cutover.LocalCutoverExecuted -ne
    $true
) {
    throw "13.39 : cutover 13.37 non valide."
}

# ============================================================
# NORMALIZE VERSIONS
# ============================================================

$baselineVersion =
    [string]$audit.LocalBaselineVersion

if (
    $baselineVersion -notmatch
    '^\d{14}$'
) {
    throw (
        "13.39 : version baseline invalide : " +
        $baselineVersion
    )
}

$remoteVersions =
    @(
        $audit.RemoteRecordedVersions |
        ForEach-Object {
            [string]$_
        } |
        Where-Object {
            $_ -match '^\d{14}$'
        } |
        Sort-Object -Unique
    )

$archiveVersions =
    @(
        $audit.ArchivedPreviousVersions |
        ForEach-Object {
            [string]$_
        } |
        Where-Object {
            $_ -match '^\d{14}$'
        } |
        Sort-Object -Unique
    )

if (
    $remoteVersions.Count -lt 1
) {
    throw "13.39 : historique distant vide."
}

# ============================================================
# IDENTIFY UNKNOWN REMOTE VERSIONS
# ============================================================

$unknownRemote =
    @(
        $remoteVersions |
        Where-Object {
            $_ -ne $baselineVersion -and
            $_ -notin $archiveVersions
        }
    )

$knownRemoteHistorical =
    @(
        $remoteVersions |
        Where-Object {
            $_ -ne $baselineVersion -and
            $_ -in $archiveVersions
        }
    )

$baselineAlreadyRemote =
    (
        $baselineVersion -in
        $remoteVersions
    )

# ============================================================
# SAFETY DECISION
# ============================================================

$repairPlanSafe =
    (
        $unknownRemote.Count -eq 0
    )

$requiresRepair =
    (
        $audit.RemoteMatchesCanonicalHistory -ne
        $true
    )

$revertVersions =
    @(
        $knownRemoteHistorical |
        Sort-Object
    )

$applyVersions =
    @()

if (
    -not $baselineAlreadyRemote
) {
    $applyVersions +=
        $baselineVersion
}

# ============================================================
# GENERATE COMMANDS - DO NOT EXECUTE
# ============================================================

$commands =
    New-Object System.Collections.Generic.List[string]

$commands.Add(
    "# ============================================================"
)

$commands.Add(
    "# KLYX 13.39 MIGRATION REPAIR PLAN"
)

$commands.Add(
    "# GENERATED ONLY - DO NOT EXECUTE AUTOMATICALLY"
)

$commands.Add(
    "# ============================================================"
)

$commands.Add(
    ""
)

$commands.Add(
    'Set-Location "C:\Users\fenjo\Documents\klyx"'
)

$commands.Add(
    ""
)

foreach (
    $version
    in $revertVersions
) {
    $commands.Add(
        (
            "npx.cmd supabase migration repair " +
            $version +
            " --status reverted --linked"
        )
    )
}

if (
    $revertVersions.Count -gt 0 -and
    $applyVersions.Count -gt 0
) {
    $commands.Add(
        ""
    )
}

foreach (
    $version
    in $applyVersions
) {
    $commands.Add(
        (
            "npx.cmd supabase migration repair " +
            $version +
            " --status applied --linked"
        )
    )
}

$commands.Add(
    ""
)

$commands.Add(
    "npx.cmd supabase migration list --linked"
)

$commands.Add(
    ""
)

$commands.Add(
    "# END OF PLAN"
)

[System.IO.File]::WriteAllLines(
    $commandFile,
    $commands,
    $utf8
)

# ============================================================
# STRUCTURED PLAN
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.39"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        CanonicalBaselineVersion =
            $baselineVersion

        BaselineAlreadyRecordedRemote =
            $baselineAlreadyRemote

        RemoteRecordedVersions =
            $remoteVersions

        ArchivedHistoricalVersions =
            $archiveVersions

        KnownHistoricalRemoteVersions =
            $knownRemoteHistorical

        UnknownRemoteVersions =
            $unknownRemote

        VersionsToMarkReverted =
            $revertVersions

        VersionsToMarkApplied =
            $applyVersions

        RevertCount =
            $revertVersions.Count

        ApplyCount =
            $applyVersions.Count

        RequiresRepair =
            $requiresRepair

        RepairPlanSafe =
            $repairPlanSafe

        CommandsGenerated =
            (
                $revertVersions.Count +
                $applyVersions.Count
            )

        ProductionDatabaseModified =
            $false

        LinkedReadUsed =
            $false

        LinkedWriteUsed =
            $false

        MigrationRepairExecuted =
            $false

        DbPushLinkedUsed =
            $false

        DbResetLinkedUsed =
            $false

        SchemaModified =
            $false

        RepairPlanOnly =
            $true
    }

[System.IO.File]::WriteAllText(
    $planJson,
    (
        $result |
        ConvertTo-Json -Depth 100
    ),
    $utf8
)

# ============================================================
# HUMAN REPORT
# ============================================================

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add(
    "======================================"
)

$lines.Add(
    "KLYX 13.39 - MIGRATION REPAIR PLAN"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "Canonical baseline : " +
    $baselineVersion
)

$lines.Add(
    "Remote migrations : " +
    $remoteVersions.Count
)

$lines.Add(
    "Archived historical migrations : " +
    $archiveVersions.Count
)

$lines.Add(
    ""
)

$lines.Add(
    "Baseline already remote : " +
    $baselineAlreadyRemote
)

$lines.Add(
    "Requires repair : " +
    $requiresRepair
)

$lines.Add(
    "Repair plan safe : " +
    $repairPlanSafe
)

$lines.Add(
    ""
)

$lines.Add(
    "Versions to mark REVERTED : " +
    $revertVersions.Count
)

foreach (
    $version
    in $revertVersions
) {
    $lines.Add(
        "  REVERTED -> " +
        $version
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "Versions to mark APPLIED : " +
    $applyVersions.Count
)

foreach (
    $version
    in $applyVersions
) {
    $lines.Add(
        "  APPLIED -> " +
        $version
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "Unknown remote versions : " +
    $unknownRemote.Count
)

foreach (
    $version
    in $unknownRemote
) {
    $lines.Add(
        "  UNKNOWN -> " +
        $version
    )
}

$lines.Add(
    ""
)

$lines.Add(
    "IMPORTANT:"
)

$lines.Add(
    "migration repair only changes Supabase migration history."
)

$lines.Add(
    "It must not be used to alter application schema in this step."
)

$lines.Add(
    ""
)

$lines.Add(
    "Production DB modified : NON"
)

$lines.Add(
    "Schema modified : NON"
)

$lines.Add(
    "Linked write : NON"
)

$lines.Add(
    "migration repair executed : NON"
)

$lines.Add(
    "db push --linked : NON"
)

$lines.Add(
    "db reset --linked : NON"
)

$lines.Add(
    ""
)

$lines.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $planText,
    $lines,
    $utf8
)

if (
    $unknownRemote.Count -gt 0
) {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX 13.39 SAFETY BLOCK"
    Write-Host "======================================"
    Write-Host (
        "Unknown remote versions : " +
        $unknownRemote.Count
    )
    Write-Host "Repair execution MUST remain blocked."
    Write-Host "Production DB : NON TOUCHEE"
    Write-Host "======================================"

    exit 39
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.39 REPAIR PLAN OK"
Write-Host "======================================"
Write-Host (
    "Canonical baseline : " +
    $baselineVersion
)
Write-Host (
    "Versions to revert : " +
    $revertVersions.Count
)
Write-Host (
    "Versions to apply : " +
    $applyVersions.Count
)
Write-Host "Unknown remote versions : 0"
Write-Host "Repair plan safe : OUI"
Write-Host "migration repair executed : NON"
Write-Host "Production DB : NON TOUCHEE"
Write-Host "======================================"