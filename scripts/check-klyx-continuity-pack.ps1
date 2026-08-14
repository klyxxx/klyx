$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$required = @(
    "docs\KLYX_MASTER_STATE.md",
    "docs\KLYX_NEXT_SESSION_PROMPT.md",
    "docs\KLYX_CONTINUITY_STATE.json",
    "scripts\capture-klyx-continuity.ps1"
)

foreach ($relative in $required) {

    $full =
        Join-Path $root $relative

    if (
        -not (
            Test-Path `
                -LiteralPath $full `
                -PathType Leaf
        )
    ) {
        throw "CONTINUITY : fichier manquant : $relative"
    }
}

$master =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "docs\KLYX_MASTER_STATE.md"
        )
    )

if (
    -not $master.Contains(
        "13.61"
    )
) {
    throw "CONTINUITY : etape courante absente."
}

if (
    -not $master.Contains(
        "automaticExecutionAllowed = false"
    )
) {
    throw "CONTINUITY : invariant execution absent."
}

if (
    $master -match
    'sk-proj-[A-Za-z0-9_-]{20,}'
) {
    throw "CONTINUITY SECURITY : cle OpenAI detectee."
}

if (
    $master -match
    'SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\r\n]+'
) {
    throw "CONTINUITY SECURITY : secret Supabase detecte."
}

Write-Host ""
Write-Host "Creating repository snapshot..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File (
        Join-Path `
            $root `
            "scripts\capture-klyx-continuity.ps1"
    )

if ($LASTEXITCODE -ne 0) {
    throw "CONTINUITY : snapshot FAILED."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "CONTINUITY : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "CONTINUITY : TypeScript FAILED."
}

Write-Host ""
Write-Host "Production build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "CONTINUITY : build FAILED."
}

Write-Host ""
Write-Host "=========================================="
Write-Host "KLYX CONTINUITY PACK 1.0 CHECK OK"
Write-Host "=========================================="
Write-Host "Master state : OK"
Write-Host "New-chat prompt : OK"
Write-Host "Machine state : OK"
Write-Host "Repository snapshot : OK"
Write-Host "Secrets stored in continuity pack : NON"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "Current documented step : 13.61"
Write-Host "=========================================="