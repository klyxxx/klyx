$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$baselineVersion =
    "20260814000000"

$preSchema =
    Join-Path `
        $root `
        "reports\13-40-pre-repair-snapshot\remote-public-schema.sql"

$postRoot =
    Join-Path `
        $root `
        "reports\13-41-post-repair"

$postSchema =
    Join-Path `
        $postRoot `
        "remote-public-schema-final-13-41d.sql"

$postHistory =
    Join-Path `
        $postRoot `
        "remote-migration-history-final-13-41d.txt"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-history-repair-13-41.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-history-repair-13-41.txt"

if (
    -not (
        Test-Path `
            -LiteralPath `
            $preSchema
    )
) {
    throw "13.41d : snapshot schema 13.40 introuvable."
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $postRoot |
    Out-Null

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
        $text =
            [string]$line

        $normalized =
            $text.Replace(
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

        $remoteColumn =
            $parts[1].Trim()

        $remoteColumn =
            $remoteColumn.Trim(
                [char]0x0060
            )

        if (
            $remoteColumn -match
            '^\d{14}$'
        ) {
            if (
                -not $versions.Contains(
                    $remoteColumn
                )
            ) {
                $versions.Add(
                    $remoteColumn
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
# READ REMOTE HISTORY ONLY
# ============================================================

Write-Host ""
Write-Host "13.41d - Verification historique distant..."
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
        "13.41d : migration list FAILED. ExitCode=" +
        $historyExit
    )
}

[System.IO.File]::WriteAllLines(
    $postHistory,
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

Write-Host ""
Write-Host (
    "Remote versions detectees : " +
    $remoteVersions.Count
)

foreach (
    $version
    in $remoteVersions
) {
    Write-Host (
        "REMOTE -> " +
        $version
    )
}

if (
    $remoteVersions.Count -ne 1
) {
    throw (
        "13.41d : historique distant attendu=1, trouve=" +
        $remoteVersions.Count +
        " [" +
        (
            $remoteVersions -join ", "
        ) +
        "]"
    )
}

if (
    $remoteVersions[0] -ne
    $baselineVersion
) {
    throw (
        "13.41d : baseline distante incorrecte : " +
        $remoteVersions[0]
    )
}

# ============================================================
# VERIFY SCHEMA UNCHANGED
# ============================================================

$referenceHash =
    (
        Get-FileHash `
            -LiteralPath `
            $preSchema `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

Write-Host ""
Write-Host "13.41d - Verification schema production..."
Write-Host ""

$dumpCommand =
    'npx.cmd supabase db dump --linked --schema public --file "' +
    $postSchema +
    '" 2>&1'

$dumpOutput =
    @(
        cmd.exe /d /s /c $dumpCommand
    )

$dumpExit =
    $LASTEXITCODE

foreach (
    $line
    in $dumpOutput
) {
    Write-Host $line
}

if (
    $dumpExit -ne 0
) {
    throw (
        "13.41d : db dump FAILED. ExitCode=" +
        $dumpExit
    )
}

$currentHash =
    (
        Get-FileHash `
            -LiteralPath `
            $postSchema `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$schemaUnchanged =
    (
        $referenceHash -eq
        $currentHash
    )

if (
    -not $schemaUnchanged
) {
    throw "13.41d : schema production different de 13.40."
}

$result =
    [pscustomobject]@{
        Step =
            "13.41d"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        ParserSupportsBackticks =
            $true

        RemoteVersions =
            $remoteVersions

        RemoteMigrationCount =
            $remoteVersions.Count

        CanonicalBaselineVersion =
            $baselineVersion

        RemoteHistoryCanonical =
            $true

        ReferenceSchemaSha256 =
            $referenceHash

        CurrentSchemaSha256 =
            $currentHash

        ProductionSchemaUnchanged =
            $schemaUnchanged

        ApplicationSchemaModified =
            $false

        ApplicationDataModified =
            $false

        MigrationRepairExecutedThisRun =
            $false

        LinkedWriteUsedThisRun =
            $false

        DbPushLinkedUsed =
            $false

        DbResetLinkedUsed =
            $false

        MigrationUpLinkedUsed =
            $false

        RepairCompleted =
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

$report =
    @(
        "======================================",
        "KLYX 13.41d - FINAL HISTORY VERIFICATION",
        "======================================",
        "",
        "Remote migration count : 1",
        (
            "Canonical remote baseline : " +
            $baselineVersion
        ),
        "Remote migration history : CANONICAL",
        "Production public schema unchanged : OUI",
        "Application schema modified : NON",
        "Application data modified : NON",
        "migration repair this run : NON",
        "linked write this run : NON",
        "db push --linked : NON",
        "db reset --linked : NON",
        "",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.41d HISTORY VERIFIED"
Write-Host "======================================"
Write-Host "Remote migration count : 1"
Write-Host (
    "Canonical remote baseline : " +
    $baselineVersion
)
Write-Host "Remote migration history : CANONICAL"
Write-Host "Production public schema : UNCHANGED"
Write-Host "Application data : UNCHANGED"
Write-Host "migration repair this run : NON"
Write-Host "Linked write this run : NON"
Write-Host "======================================"