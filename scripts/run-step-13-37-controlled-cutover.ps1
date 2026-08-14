$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

$officialDir =
    Join-Path `
        $root `
        "supabase\migrations"

$candidate =
    Join-Path `
        $root `
        "supabase\canonical-migrations-13-36\20260814000000_klyx_canonical_baseline.sql"

$manifest13_36 =
    Join-Path `
        $root `
        "reports\supabase-canonical-cutover-manifest-13-36.json"

$archiveRoot =
    Join-Path `
        $root `
        "supabase\migration-history-archive-13-37"

$archiveOfficial =
    Join-Path `
        $archiveRoot `
        "previous-official"

$newBaselineName =
    "20260814000000_klyx_canonical_baseline.sql"

$newBaseline =
    Join-Path `
        $officialDir `
        $newBaselineName

$manifestPath =
    Join-Path `
        $root `
        "reports\supabase-controlled-cutover-manifest-13-37.json"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-controlled-cutover-13-37.txt"

$workRoot =
    Join-Path `
        $root `
        ".klyx-cutover-rebuild-13-37"

# ============================================================
# SAFETY GATES
# ============================================================

foreach (
    $required
    in @(
        $officialDir,
        $candidate,
        $manifest13_36
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
            "13.37 : requis introuvable : " +
            $required
        )
    }
}

$data13_36 =
    Get-Content `
        -LiteralPath `
        $manifest13_36 `
        -Raw |
    ConvertFrom-Json

if (
    $data13_36.ReadyForControlledCutover -ne
    $true
) {
    throw "13.37 : gate 13.36 non valide."
}

if (
    $data13_36.Fidelity13_35Verified -ne
    $true
) {
    throw "13.37 : fidelity 13.35 non valide."
}

if (
    $data13_36.ProductionDatabaseModified -ne
    $false
) {
    throw "13.37 : etat production 13.36 invalide."
}

# ============================================================
# INVENTORY CURRENT OFFICIAL MIGRATIONS
# ============================================================

$beforeFiles =
    @(
        Get-ChildItem `
            -LiteralPath `
            $officialDir `
            -File `
            -Filter "*.sql" |
        Sort-Object Name
    )

if (
    $beforeFiles.Count -lt 1
) {
    throw "13.37 : aucune migration officielle a archiver."
}

$beforeInventory =
    @()

foreach (
    $file
    in $beforeFiles
) {
    $beforeInventory +=
        [pscustomobject]@{
            Name =
                $file.Name

            Sha256 =
                (
                    Get-FileHash `
                        -LiteralPath `
                        $file.FullName `
                        -Algorithm SHA256
                ).Hash.ToLowerInvariant()

            Length =
                $file.Length
        }
}

# ============================================================
# CREATE ARCHIVE
# ============================================================

if (
    Test-Path `
        -LiteralPath `
        $archiveRoot
) {
    throw (
        "13.37 : archive deja presente. " +
        "Refus de remplacer une archive existante."
    )
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $archiveOfficial |
    Out-Null

foreach (
    $file
    in $beforeFiles
) {
    Copy-Item `
        -LiteralPath `
        $file.FullName `
        -Destination (
            Join-Path `
                $archiveOfficial `
                $file.Name
        ) `
        -Force
}

# ============================================================
# VERIFY ARCHIVE HASHES
# ============================================================

foreach (
    $entry
    in $beforeInventory
) {
    $archived =
        Join-Path `
            $archiveOfficial `
            $entry.Name

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $archived
        )
    ) {
        throw (
            "13.37 : archive manquante : " +
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
            "13.37 : hash archive invalide : " +
            $entry.Name
        )
    }
}

# ============================================================
# LOCAL CUTOVER
# ============================================================

foreach (
    $file
    in $beforeFiles
) {
    Remove-Item `
        -LiteralPath `
        $file.FullName `
        -Force
}

Copy-Item `
    -LiteralPath `
    $candidate `
    -Destination `
    $newBaseline `
    -Force

if (
    -not (
        Test-Path `
            -LiteralPath `
            $newBaseline
    )
) {
    throw "13.37 : baseline canonique non promue."
}

$afterFiles =
    @(
        Get-ChildItem `
            -LiteralPath `
            $officialDir `
            -File `
            -Filter "*.sql"
    )

if (
    $afterFiles.Count -ne
    1
) {
    throw (
        "13.37 : migrations officielles attendues=1, trouvees=" +
        $afterFiles.Count
    )
}

if (
    $afterFiles[0].Name -ne
    $newBaselineName
) {
    throw "13.37 : mauvais fichier canonique officiel."
}

# ============================================================
# CRITICAL SCHEMA VALIDATION
# ============================================================

$sql =
    [System.IO.File]::ReadAllText(
        $newBaseline
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
                $sql,
                $pattern
            )
        )
    ) {
        throw (
            "13.37 : table critique absente : " +
            $table
        )
    }
}

# ============================================================
# DISPOSABLE LOCAL REBUILD
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
            "13.37 : supabase init FAILED. ExitCode=" +
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
    $newBaseline `
    -Destination (
        Join-Path `
            $workMigrations `
            $newBaselineName
    ) `
    -Force

$started =
    $false

Push-Location $workRoot

try {
    Write-Host ""
    Write-Host "Starting 13.37 disposable canonical rebuild..."
    Write-Host ""

    $output =
        @(
            cmd.exe /d /s /c `
                "npx.cmd supabase start 2>&1"
        )

    $startExit =
        $LASTEXITCODE

    foreach (
        $line
        in $output
    ) {
        Write-Host $line
    }

    if (
        $startExit -ne 0
    ) {
        throw (
            "13.37 : canonical local rebuild FAILED. ExitCode=" +
            $startExit
        )
    }

    $started =
        $true
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
# MANIFEST
# ============================================================

$baselineHash =
    (
        Get-FileHash `
            -LiteralPath `
            $newBaseline `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

$manifest =
    [pscustomobject]@{
        Step =
            "13.37"

        GeneratedAt =
            (
                Get-Date
            ).ToString(
                "o"
            )

        PreviousOfficialMigrationCount =
            $beforeInventory.Count

        ArchivedMigrationCount =
            @(
                Get-ChildItem `
                    -LiteralPath `
                    $archiveOfficial `
                    -File `
                    -Filter "*.sql"
            ).Count

        OfficialMigrationCountAfter =
            1

        CanonicalBaseline =
            "supabase\migrations\$newBaselineName"

        CanonicalBaselineSha256 =
            $baselineHash

        PreviousOfficialMigrations =
            $beforeInventory

        ArchiveHashesVerified =
            $true

        CriticalSchemaVerified =
            $true

        FreshLocalRebuildSucceeded =
            $true

        ProductionDatabaseModified =
            $false

        LinkedWriteUsed =
            $false

        DbPushLinkedUsed =
            $false

        DbResetLinkedUsed =
            $false

        LocalCutoverExecuted =
            $true
    }

[System.IO.File]::WriteAllText(
    $manifestPath,
    (
        $manifest |
        ConvertTo-Json -Depth 100
    ),
    $utf8
)

$report =
    @(
        "======================================",
        "KLYX 13.37 - CONTROLLED LOCAL CUTOVER",
        "======================================",
        "",
        (
            "Previous official migrations : " +
            $beforeInventory.Count
        ),
        (
            "Archived migrations : " +
            $beforeInventory.Count
        ),
        "Official migrations after : 1",
        (
            "Canonical baseline : " +
            $newBaselineName
        ),
        (
            "Canonical SHA256 : " +
            $baselineHash
        ),
        "",
        "Archive hashes verified : OUI",
        "Critical schema verified : OUI",
        "Fresh local rebuild : OK",
        "",
        "Production DB modified : NON",
        "Linked write used : NON",
        "db push --linked : NON",
        "db reset --linked : NON",
        "",
        "Local cutover executed : OUI",
        "======================================"
    )

[System.IO.File]::WriteAllLines(
    $reportPath,
    $report,
    $utf8
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.37 LOCAL CUTOVER OK"
Write-Host "======================================"
Write-Host (
    "Archived old migrations : " +
    $beforeInventory.Count
)
Write-Host "Official migration count : 1"
Write-Host "Canonical baseline : PROMOTED"
Write-Host "Archive hashes : VERIFIED"
Write-Host "Fresh local rebuild : OK"
Write-Host "Production DB : NON TOUCHEE"
Write-Host "Linked writes : NON"
Write-Host "======================================"