$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$officialDir =
    Join-Path `
        $root `
        "supabase\migrations"

$archiveDir =
    Join-Path `
        $root `
        "supabase\migration-history-archive-13-37\previous-official"

$manifest13_37 =
    Join-Path `
        $root `
        "reports\supabase-controlled-cutover-manifest-13-37.json"

$rawPath =
    Join-Path `
        $root `
        "reports\supabase-remote-migration-list-13-38.txt"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-remote-history-audit-13-38.json"

$textPath =
    Join-Path `
        $root `
        "reports\supabase-remote-history-audit-13-38.txt"

# ============================================================
# SAFETY INPUTS
# ============================================================

foreach (
    $required
    in @(
        $officialDir,
        $archiveDir,
        $manifest13_37
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
            "13.38 : requis introuvable : " +
            $required
        )
    }
}

$data13_37 =
    Get-Content `
        -LiteralPath `
        $manifest13_37 `
        -Raw |
    ConvertFrom-Json

if (
    $data13_37.LocalCutoverExecuted -ne
    $true
) {
    throw "13.38 : cutover local 13.37 non valide."
}

if (
    $data13_37.ProductionDatabaseModified -ne
    $false
) {
    throw "13.38 : etat production 13.37 invalide."
}

# ============================================================
# LOCAL OFFICIAL HISTORY
# ============================================================

$localFiles =
    @(
        Get-ChildItem `
            -LiteralPath `
            $officialDir `
            -File `
            -Filter "*.sql" |
        Sort-Object Name
    )

if (
    $localFiles.Count -ne
    1
) {
    throw (
        "13.38 : historique local attendu=1, trouve=" +
        $localFiles.Count
    )
}

$localVersions =
    @()

foreach (
    $file
    in $localFiles
) {
    $hit =
        [regex]::Match(
            $file.Name,
            '^(\d{14})'
        )

    if (
        $hit.Success
    ) {
        $localVersions +=
            $hit.Groups[1].Value
    }
}

if (
    $localVersions.Count -ne
    1
) {
    throw "13.38 : timestamp baseline locale introuvable."
}

# ============================================================
# ARCHIVED PREVIOUS HISTORY
# ============================================================

$archiveFiles =
    @(
        Get-ChildItem `
            -LiteralPath `
            $archiveDir `
            -File `
            -Filter "*.sql" |
        Sort-Object Name
    )

$archiveVersions =
    @()

foreach (
    $file
    in $archiveFiles
) {
    $hit =
        [regex]::Match(
            $file.Name,
            '^(\d{14})'
        )

    if (
        $hit.Success
    ) {
        $archiveVersions +=
            $hit.Groups[1].Value
    }
}

$archiveVersions =
    @(
        $archiveVersions |
        Sort-Object -Unique
    )

# ============================================================
# READ REMOTE MIGRATION HISTORY
# READ ONLY
# ============================================================

Write-Host ""
Write-Host "Reading linked Supabase migration history..."
Write-Host ""

$remoteOutput =
    @(
        cmd.exe /d /s /c `
            "npx.cmd supabase migration list --linked 2>&1"
    )

$remoteExit =
    $LASTEXITCODE

foreach (
    $line
    in $remoteOutput
) {
    Write-Host $line
}

[System.IO.File]::WriteAllLines(
    $rawPath,
    @(
        $remoteOutput |
        ForEach-Object {
            [string]$_
        }
    ),
    $utf8
)

if (
    $remoteExit -ne 0
) {
    throw (
        "13.38 : migration list --linked FAILED. ExitCode=" +
        $remoteExit
    )
}

# ============================================================
# EXTRACT REMOTE VERSIONS
# ============================================================

$remoteVersions =
    @()

foreach (
    $line
    in $remoteOutput
) {
    $matches13_38 =
        [regex]::Matches(
            [string]$line,
            '(?<!\d)(\d{14})(?!\d)'
        )

    foreach (
        $match13_38
        in $matches13_38
    ) {
        $version =
            $match13_38.Groups[1].Value

        if (
            $version -notin
            $remoteVersions
        ) {
            $remoteVersions +=
                $version
        }
    }
}

$remoteVersions =
    @(
        $remoteVersions |
        Sort-Object -Unique
    )

if (
    $remoteVersions.Count -lt 1
) {
    throw "13.38 : aucun timestamp de migration distante detecte."
}

# ============================================================
# COMPARE HISTORIES
# ============================================================

$localBaseline =
    $localVersions[0]

$baselineRecordedRemote =
    (
        $localBaseline -in
        $remoteVersions
    )

$archivedVersionsRecordedRemote =
    @(
        $archiveVersions |
        Where-Object {
            $_ -in
            $remoteVersions
        }
    )

$archivedVersionsMissingRemote =
    @(
        $archiveVersions |
        Where-Object {
            $_ -notin
            $remoteVersions
        }
    )

$remoteVersionsNotArchived =
    @(
        $remoteVersions |
        Where-Object {
            $_ -notin
            $archiveVersions -and
            $_ -ne
            $localBaseline
        }
    )

$remoteMatchesPreviousHistory =
    (
        $archiveVersions.Count -gt 0 -and
        $archivedVersionsMissingRemote.Count -eq 0
    )

$remoteMatchesCanonicalHistory =
    (
        $remoteVersions.Count -eq 1 -and
        $baselineRecordedRemote
    )

$historyCutoverRequired =
    (
        -not $remoteMatchesCanonicalHistory
    )

# ============================================================
# RESULT
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.38"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        LocalCanonicalVersions =
            $localVersions

        LocalCanonicalCount =
            $localVersions.Count

        ArchivedPreviousVersions =
            $archiveVersions

        ArchivedPreviousCount =
            $archiveVersions.Count

        RemoteRecordedVersions =
            $remoteVersions

        RemoteRecordedCount =
            $remoteVersions.Count

        LocalBaselineVersion =
            $localBaseline

        BaselineRecordedRemote =
            $baselineRecordedRemote

        ArchivedVersionsRecordedRemote =
            $archivedVersionsRecordedRemote

        ArchivedVersionsMissingRemote =
            $archivedVersionsMissingRemote

        RemoteVersionsNotArchived =
            $remoteVersionsNotArchived

        RemoteMatchesPreviousHistory =
            $remoteMatchesPreviousHistory

        RemoteMatchesCanonicalHistory =
            $remoteMatchesCanonicalHistory

        HistoryCutoverRequired =
            $historyCutoverRequired

        AuditCompleted =
            $true

        ProductionDatabaseModified =
            $false

        LinkedReadUsed =
            $true

        LinkedWriteUsed =
            $false

        MigrationRepairUsed =
            $false

        DbPushLinkedUsed =
            $false

        DbResetLinkedUsed =
            $false
    }

[System.IO.File]::WriteAllText(
    $jsonPath,
    (
        $result |
        ConvertTo-Json -Depth 100
    ),
    $utf8
)

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add(
    "======================================"
)

$lines.Add(
    "KLYX 13.38 - REMOTE MIGRATION HISTORY AUDIT"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "Local canonical version : " +
    $localBaseline
)

$lines.Add(
    "Local canonical count : " +
    $localVersions.Count
)

$lines.Add(
    "Archived previous count : " +
    $archiveVersions.Count
)

$lines.Add(
    "Remote recorded count : " +
    $remoteVersions.Count
)

$lines.Add(
    ""
)

$lines.Add(
    "Baseline recorded remotely : " +
    $baselineRecordedRemote
)

$lines.Add(
    "Remote matches previous history : " +
    $remoteMatchesPreviousHistory
)

$lines.Add(
    "Remote matches canonical history : " +
    $remoteMatchesCanonicalHistory
)

$lines.Add(
    "History cutover required : " +
    $historyCutoverRequired
)

$lines.Add(
    ""
)

$lines.Add(
    "Archived versions present remotely : " +
    $archivedVersionsRecordedRemote.Count
)

$lines.Add(
    "Archived versions missing remotely : " +
    $archivedVersionsMissingRemote.Count
)

$lines.Add(
    "Remote versions outside archive : " +
    $remoteVersionsNotArchived.Count
)

if (
    $remoteVersionsNotArchived.Count -gt 0
) {
    $lines.Add(
        "Remote outside archive:"
    )

    foreach (
        $version
        in $remoteVersionsNotArchived
    ) {
        $lines.Add(
            "  " +
            $version
        )
    }
}

if (
    $archivedVersionsMissingRemote.Count -gt 0
) {
    $lines.Add(
        "Archived missing remotely:"
    )

    foreach (
        $version
        in $archivedVersionsMissingRemote
    ) {
        $lines.Add(
            "  " +
            $version
        )
    }
}

$lines.Add(
    ""
)

$lines.Add(
    "Production DB modified : NON"
)

$lines.Add(
    "Linked read : OUI"
)

$lines.Add(
    "Linked write : NON"
)

$lines.Add(
    "migration repair : NON"
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
    $textPath,
    $lines,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.38 REMOTE HISTORY AUDIT OK"
Write-Host "======================================"
Write-Host (
    "Local canonical migrations : " +
    $localVersions.Count
)
Write-Host (
    "Archived previous migrations : " +
    $archiveVersions.Count
)
Write-Host (
    "Remote recorded migrations : " +
    $remoteVersions.Count
)
Write-Host (
    "Canonical baseline remote : " +
    $baselineRecordedRemote
)
Write-Host (
    "History cutover required : " +
    $historyCutoverRequired
)
Write-Host "Production DB : NON TOUCHEE"
Write-Host "Linked write : NON"
Write-Host "migration repair : NON"
Write-Host "======================================"