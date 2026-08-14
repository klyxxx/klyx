$ErrorActionPreference = "Stop"

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

$root =
    Split-Path -Parent $PSScriptRoot

$baseline =
    Join-Path `
        $root `
        "supabase\baseline-staging-13-34\20260814000000_klyx_public_baseline_13_34.sql"

$workRoot =
    Join-Path `
        $root `
        ".klyx-baseline-rebuild-13-34"

$workMigrations =
    Join-Path `
        $workRoot `
        "supabase\migrations"

$reportPath =
    Join-Path `
        $root `
        "reports\supabase-baseline-rebuild-13-34.txt"

$jsonPath =
    Join-Path `
        $root `
        "reports\supabase-baseline-rebuild-13-34.json"

# KLYX_REMOTE_SCHEMA_BASELINE_REBUILD_13_34E

if (
    -not (
        Test-Path `
            -LiteralPath `
            $baseline
    )
) {
    throw "13.34e : baseline introuvable."
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
            "13.34e : supabase init FAILED. ExitCode=" +
            $initExit
        )
    }
}
finally {
    Pop-Location
}

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
            "20260814000000_klyx_public_baseline_13_34.sql"
    ) `
    -Force

$startOutput =
    @()

$startExit =
    -1

Push-Location $workRoot

try {
    Write-Host ""
    Write-Host "Starting disposable Supabase from canonical baseline..."
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
}
finally {
    if (
        $startExit -ne 0
    ) {
        cmd.exe /d /s /c `
            "npx.cmd supabase stop --no-backup >nul 2>&1" |
            Out-Null
    }

    Pop-Location
}

$success =
    (
        $startExit -eq 0
    )

$result =
    [pscustomobject]@{
        Step =
            "13.34e"

        BaselineRebuildSucceeded =
            $success

        StartExitCode =
            $startExit

        ProductionDatabaseModified =
            $false

        LinkedWriteUsed =
            $false

        OfficialMigrationsModified =
            $false

        Output =
            @(
                $startOutput
            )
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
    "KLYX 13.34e - BASELINE REBUILD"
)

$lines.Add(
    "======================================"
)

$lines.Add(
    ""
)

$lines.Add(
    "Baseline rebuild succeeded : " +
    $success
)

$lines.Add(
    "Exit code : " +
    $startExit
)

$lines.Add(
    ""
)

$lines.Add(
    "Production DB modified : NON"
)

$lines.Add(
    "Linked write used : NON"
)

$lines.Add(
    "Official migrations modified : NON"
)

$lines.Add(
    ""
)

$lines.Add(
    "---- SUPABASE OUTPUT ----"
)

foreach (
    $line
    in $startOutput
) {
    $lines.Add(
        [string]$line
    )
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
    -not $success
) {
    throw (
        "13.34e : baseline reconstruction FAILED. ExitCode=" +
        $startExit
    )
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.34e BASELINE REBUILD OK"
Write-Host "======================================"
Write-Host "Fresh Supabase : CREATED"
Write-Host "Canonical public schema : REPLAYED"
Write-Host "Production DB : NON TOUCHEE"
Write-Host "======================================"