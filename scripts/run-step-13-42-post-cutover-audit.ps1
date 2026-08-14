$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$baselineVersion =
    "20260814000000"

$officialDir =
    Join-Path `
        $root `
        "supabase\migrations"

$baseline =
    Join-Path `
        $officialDir `
        "20260814000000_klyx_canonical_baseline.sql"

$workRoot =
    Join-Path `
        $root `
        ".klyx-post-cutover-audit-13-42"

$remoteDump =
    Join-Path `
        $root `
        "reports\13-42-remote-public-schema.sql"

$localDump =
    Join-Path `
        $root `
        "reports\13-42-local-public-schema.sql"

$remoteHistoryPath =
    Join-Path `
        $root `
        "reports\13-42-remote-migration-history.txt"

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-post-cutover-audit-13-42.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-post-cutover-audit-13-42.txt"

# ============================================================
# REQUIRED LOCAL STATE
# ============================================================

if (
    -not (
        Test-Path `
            -LiteralPath `
            $baseline
    )
) {
    throw "13.42 : baseline canonique introuvable."
}

$officialSql =
    @(
        Get-ChildItem `
            -LiteralPath `
            $officialDir `
            -File `
            -Filter "*.sql"
    )

if (
    $officialSql.Count -ne 1
) {
    throw (
        "13.42 : supabase/migrations attendu=1, trouve=" +
        $officialSql.Count
    )
}

# ============================================================
# PARSER REMOTE COLUMN
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
# OBJECT INVENTORY
# ============================================================

function Get-ObjectNames {
    param(
        [string]$Sql,
        [string]$Pattern
    )

    $items =
        New-Object System.Collections.Generic.List[string]

    $regexHits =
        [regex]::Matches(
            $Sql,
            $Pattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase `
                -bor
            [System.Text.RegularExpressions.RegexOptions]::Multiline
        )

    foreach (
        $regexHit
        in $regexHits
    ) {
        $value =
            (
                [string]$regexHit.Groups[1].Value
            ).ToLowerInvariant()

        if (
            -not $items.Contains(
                $value
            )
        ) {
            $items.Add(
                $value
            )
        }
    }

    return @(
        $items |
        Sort-Object
    )
}

function Compare-Names {
    param(
        [string[]]$Remote,
        [string[]]$Local
    )

    $missing =
        @(
            $Remote |
            Where-Object {
                $_ -notin $Local
            }
        )

    $extra =
        @(
            $Local |
            Where-Object {
                $_ -notin $Remote
            }
        )

    return [pscustomobject]@{
        RemoteCount =
            @($Remote).Count

        LocalCount =
            @($Local).Count

        MissingLocal =
            $missing

        ExtraLocal =
            $extra

        Match =
            (
                $missing.Count -eq 0 -and
                $extra.Count -eq 0
            )
    }
}

# ============================================================
# REMOTE HISTORY - READ ONLY
# ============================================================

Write-Host ""
Write-Host "Reading remote migration history..."
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
        "13.42 : migration list FAILED. ExitCode=" +
        $historyExit
    )
}

[System.IO.File]::WriteAllLines(
    $remoteHistoryPath,
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
    $remoteVersions.Count -ne 1
) {
    throw (
        "13.42 : historique remote attendu=1, trouve=" +
        $remoteVersions.Count
    )
}

if (
    $remoteVersions[0] -ne
    $baselineVersion
) {
    throw (
        "13.42 : baseline remote incorrecte : " +
        $remoteVersions[0]
    )
}

# ============================================================
# REMOTE SCHEMA SNAPSHOT - READ ONLY
# ============================================================

Write-Host ""
Write-Host "Dumping production public schema..."
Write-Host ""

$remoteCommand =
    'npx.cmd supabase db dump --linked --schema public --file "' +
    $remoteDump +
    '" 2>&1'

$remoteDumpOutput =
    @(
        cmd.exe /d /s /c $remoteCommand
    )

$remoteDumpExit =
    $LASTEXITCODE

foreach (
    $line
    in $remoteDumpOutput
) {
    Write-Host $line
}

if (
    $remoteDumpExit -ne 0
) {
    throw (
        "13.42 : remote schema dump FAILED. ExitCode=" +
        $remoteDumpExit
    )
}

# ============================================================
# DISPOSABLE FRESH REBUILD
# ============================================================

if (
    Test-Path `
        -LiteralPath `
        $workRoot
) {
    Push-Location $workRoot

    try {
        cmd.exe /d /s /c `
            "npx.cmd supabase stop --no-backup >nul 2>&1" |
            Out-Null
    }
    finally {
        Pop-Location
    }

    Remove-Item `
        -LiteralPath `
        $workRoot `
        -Recurse `
        -Force
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $workRoot |
    Out-Null

Push-Location $workRoot

try {
    cmd.exe /d /s /c `
        "npx.cmd supabase init 2>&1"

    $initExit =
        $LASTEXITCODE

    if (
        $initExit -ne 0
    ) {
        throw (
            "13.42 : supabase init FAILED. ExitCode=" +
            $initExit
        )
    }
}
finally {
    Pop-Location
}

$workMigrations =
    Join-Path `
        $workRoot `
        "supabase\migrations"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $workMigrations |
    Out-Null

Copy-Item `
    -LiteralPath `
    $baseline `
    -Destination (
        Join-Path `
            $workMigrations `
            "20260814000000_klyx_canonical_baseline.sql"
    ) `
    -Force

$started =
    $false

Push-Location $workRoot

try {
    Write-Host ""
    Write-Host "Starting fresh canonical Supabase..."
    Write-Host ""

    $startOutput =
        @(
            cmd.exe /d /s /c `
                "npx.cmd supabase start 2>&1"
        )

    $startExit =
        $LASTEXITCODE

    foreach (
        $line
        in $startOutput
    ) {
        Write-Host $line
    }

    if (
        $startExit -ne 0
    ) {
        throw (
            "13.42 : fresh Supabase start FAILED. ExitCode=" +
            $startExit
        )
    }

    $started =
        $true

    Write-Host ""
    Write-Host "Dumping reconstructed local schema..."
    Write-Host ""

    $localCommand =
        'npx.cmd supabase db dump --local --schema public --file "' +
        $localDump +
        '" 2>&1'

    $localDumpOutput =
        @(
            cmd.exe /d /s /c $localCommand
        )

    $localDumpExit =
        $LASTEXITCODE

    foreach (
        $line
        in $localDumpOutput
    ) {
        Write-Host $line
    }

    if (
        $localDumpExit -ne 0
    ) {
        throw (
            "13.42 : local schema dump FAILED. ExitCode=" +
            $localDumpExit
        )
    }
}
finally {
    if (
        $started
    ) {
        cmd.exe /d /s /c `
            "npx.cmd supabase stop --no-backup >nul 2>&1" |
            Out-Null
    }

    Pop-Location
}

# ============================================================
# COMPARE OBJECT INVENTORIES
# ============================================================

$remoteSql =
    [System.IO.File]::ReadAllText(
        $remoteDump
    )

$localSql =
    [System.IO.File]::ReadAllText(
        $localDump
    )

$patterns =
    [ordered]@{
        Tables =
            'CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"public"\."([^"]+)"'

        Views =
            'CREATE(?:\s+OR\s+REPLACE)?\s+VIEW\s+"public"\."([^"]+)"'

        Functions =
            'CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+"public"\."([^"]+)"'

        Indexes =
            'CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"'

        Policies =
            'CREATE\s+POLICY\s+"([^"]+)"'

        Triggers =
            'CREATE(?:\s+OR\s+REPLACE)?\s+TRIGGER\s+"([^"]+)"'

        Types =
            'CREATE\s+TYPE\s+"public"\."([^"]+)"'
    }

$comparisons =
    [ordered]@{}

$allMatch =
    $true

foreach (
    $category
    in $patterns.Keys
) {
    $remoteNames =
        @(
            Get-ObjectNames `
                -Sql $remoteSql `
                -Pattern $patterns[$category]
        )

    $localNames =
        @(
            Get-ObjectNames `
                -Sql $localSql `
                -Pattern $patterns[$category]
        )

    $comparison =
        Compare-Names `
            -Remote $remoteNames `
            -Local $localNames

    $comparisons[$category] =
        $comparison

    if (
        -not $comparison.Match
    ) {
        $allMatch =
            $false
    }
}

# ============================================================
# CRITICAL TABLES
# ============================================================

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
                $localSql,
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
        "13.42 : tables critiques absentes : " +
        (
            $missingCritical -join ", "
        )
    )
}

if (
    -not $allMatch
) {
    throw "13.42 : inventaires remote/local differents."
}

# ============================================================
# HASHES
# ============================================================

$baselineHash =
    (
        Get-FileHash `
            -LiteralPath `
            $baseline `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$remoteDumpHash =
    (
        Get-FileHash `
            -LiteralPath `
            $remoteDump `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$localDumpHash =
    (
        Get-FileHash `
            -LiteralPath `
            $localDump `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

# ============================================================
# MANIFEST
# ============================================================

$result =
    [pscustomobject]@{
        Step =
            "13.42"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        CanonicalBaselineVersion =
            $baselineVersion

        LocalOfficialMigrationCount =
            $officialSql.Count

        RemoteMigrationVersions =
            $remoteVersions

        RemoteMigrationCount =
            $remoteVersions.Count

        LocalRemoteHistoryAligned =
            $true

        FreshLocalRebuildSucceeded =
            $true

        ObjectInventoriesEqual =
            $allMatch

        Comparisons =
            $comparisons

        CriticalTablesPresent =
            $true

        CanonicalBaselineSha256 =
            $baselineHash

        RemoteSchemaSha256 =
            $remoteDumpHash

        LocalSchemaSha256 =
            $localDumpHash

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

        MigrationUpLinkedUsed =
            $false

        PostCutoverAuditComplete =
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
    New-Object System.Collections.Generic.List[string]

$report.Add(
    "======================================"
)

$report.Add(
    "KLYX 13.42 - POST-CUTOVER INTEGRITY AUDIT"
)

$report.Add(
    "======================================"
)

$report.Add(
    ""
)

$report.Add(
    "Canonical baseline : " +
    $baselineVersion
)

$report.Add(
    "Local official migrations : 1"
)

$report.Add(
    "Remote migration records : 1"
)

$report.Add(
    "Local/remote history aligned : OUI"
)

$report.Add(
    "Fresh canonical rebuild : OK"
)

$report.Add(
    ""
)

foreach (
    $category
    in $comparisons.Keys
) {
    $report.Add(
        (
            $category +
            " : MATCH (" +
            $comparisons[$category].RemoteCount +
            ")"
        )
    )
}

$report.Add(
    ""
)

$report.Add(
    "Critical KLYX schema : PRESENT"
)

$report.Add(
    "Production DB modified : NON"
)

$report.Add(
    "Production schema modified : NON"
)

$report.Add(
    "Linked write : NON"
)

$report.Add(
    "migration repair : NON"
)

$report.Add(
    "db push --linked : NON"
)

$report.Add(
    "db reset --linked : NON"
)

$report.Add(
    ""
)

$report.Add(
    "======================================"
)

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.42 POST-CUTOVER AUDIT OK"
Write-Host "======================================"
Write-Host "Local migration history : CANONICAL"
Write-Host "Remote migration history : CANONICAL"
Write-Host "Canonical version : 20260814000000"
Write-Host "Fresh local rebuild : OK"
Write-Host "Tables : MATCH"
Write-Host "Views : MATCH"
Write-Host "Functions : MATCH"
Write-Host "Indexes : MATCH"
Write-Host "Policies : MATCH"
Write-Host "Triggers : MATCH"
Write-Host "Types : MATCH"
Write-Host "Critical KLYX schema : PRESENT"
Write-Host "Production linked writes : NON"
Write-Host "======================================"