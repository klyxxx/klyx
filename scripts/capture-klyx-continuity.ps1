$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$reportDir =
    Join-Path $root "reports\continuity"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $reportDir |
    Out-Null

$report =
    Join-Path $reportDir "CURRENT_REPOSITORY_STATE.txt"

$lines =
    New-Object System.Collections.Generic.List[string]

$lines.Add("KLYX CURRENT REPOSITORY STATE")
$lines.Add("=============================")
$lines.Add("Generated: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
$lines.Add("")

$lines.Add("GIT BRANCH")
$lines.Add("----------")

$branch =
    (& git branch --show-current 2>$null)

if ($LASTEXITCODE -eq 0) {
    $lines.Add([string]$branch)
}
else {
    $lines.Add("Unavailable")
}

$lines.Add("")
$lines.Add("GIT HEAD")
$lines.Add("--------")

$head =
    (& git rev-parse HEAD 2>$null)

if ($LASTEXITCODE -eq 0) {
    $lines.Add([string]$head)
}
else {
    $lines.Add("Unavailable")
}

$lines.Add("")
$lines.Add("GIT STATUS")
$lines.Add("----------")

$status =
    @(& git status --short 2>$null)

if ($LASTEXITCODE -eq 0) {
    if ($status.Count -eq 0) {
        $lines.Add("Clean")
    }
    else {
        foreach ($item in $status) {
            $lines.Add([string]$item)
        }
    }
}
else {
    $lines.Add("Unavailable")
}

$lines.Add("")
$lines.Add("APP ROUTES")
$lines.Add("----------")

$appPath =
    Join-Path $root "app"

$routeFiles =
    Get-ChildItem `
        -LiteralPath $appPath `
        -Recurse `
        -File `
        -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -in @(
            "page.tsx",
            "route.ts"
        )
    }

$lines.Add(
    "Detected route/page files: " +
    $routeFiles.Count
)

$lines.Add("")
$lines.Add("MIGRATIONS")
$lines.Add("----------")

$migrations =
    Get-ChildItem `
        -LiteralPath (
            Join-Path $root "supabase\migrations"
        ) `
        -File `
        -ErrorAction SilentlyContinue |
    Sort-Object Name

if ($migrations) {
    foreach ($migration in $migrations) {
        $lines.Add($migration.Name)
    }
}
else {
    $lines.Add("No migration files detected.")
}

$lines.Add("")
$lines.Add("CONTINUITY FILES")
$lines.Add("----------------")

$required = @(
    "docs\KLYX_MASTER_STATE.md",
    "docs\KLYX_NEXT_SESSION_PROMPT.md",
    "docs\KLYX_CONTINUITY_STATE.json"
)

foreach ($relative in $required) {
    $full =
        Join-Path $root $relative

    if (Test-Path -LiteralPath $full) {
        $lines.Add("$relative : OK")
    }
    else {
        $lines.Add("$relative : MISSING")
    }
}

$lines.Add("")
$lines.Add("ENVIRONMENT")
$lines.Add("-----------")

$envPath =
    Join-Path $root ".env.local"

if (Test-Path -LiteralPath $envPath) {
    $lines.Add(".env.local : PRESENT")
}
else {
    $lines.Add(".env.local : MISSING")
}

$lines.Add("Secret values intentionally omitted.")

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllLines(
    $report,
    $lines,
    $utf8
)

Write-Host ""
Write-Host "KLYX CONTINUITY SNAPSHOT OK"
Write-Host "Report : reports\continuity\CURRENT_REPOSITORY_STATE.txt"
Write-Host "Secrets captured : NON"