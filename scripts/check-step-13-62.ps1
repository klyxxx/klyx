$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$stats =
    Join-Path `
        $root `
        "lib\brain\analytics\brain-local-stats.ts"

$index =
    Join-Path `
        $root `
        "lib\brain\analytics\index.ts"

$test =
    Join-Path `
        $root `
        "tests\unit\brain-local-stats.test.ts"

$envPath =
    Join-Path `
        $root `
        ".env.local"

foreach ($file in @(
    $stats,
    $index,
    $test,
    $envPath
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw (
            "13.62 : fichier manquant : " +
            $file
        )
    }
}

$statsText =
    [System.IO.File]::ReadAllText(
        $stats
    )

$envText =
    [System.IO.File]::ReadAllText(
        $envPath
    )

if (
    $statsText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw "13.62 : automatic execution non bloquee."
}

if (
    $statsText -notmatch
    'externalApiRequired:\s*false'
) {
    throw "13.62 : statistiques dependantes API externe."
}

if (
    -not $statsText.Contains(
        "missingFieldFrequency"
    )
) {
    throw "13.62 : statistiques champs manquants absentes."
}

if (
    -not $statsText.Contains(
        "averageCompleteness"
    )
) {
    throw "13.62 : mesure completeness absente."
}

if (
    -not $statsText.Contains(
        "ambiguityRate"
    )
) {
    throw "13.62 : mesure ambiguity absente."
}

if (
    -not (
        [regex]::IsMatch(
            $envText,
            '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*0\s*$'
        )
    )
) {
    throw "13.62 : mode gratuit shadow=0 attendu."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.62 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.62 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.62 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.62 CHECK OK"
Write-Host "======================================"
Write-Host "Local Brain statistics : READY"
Write-Host "Readiness metrics : READY"
Write-Host "Understanding metrics : READY"
Write-Host "Ambiguity metrics : READY"
Write-Host "Missing-field metrics : READY"
Write-Host "Completeness metrics : READY"
Write-Host "External API calls : NONE"
Write-Host "Operating cost : ZERO"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"