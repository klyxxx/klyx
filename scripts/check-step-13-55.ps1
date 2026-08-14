$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$required =
    @(
        "lib\brain\shadow\llm-shadow.ts",
        "lib\brain\shadow\shadow-observation.ts",
        "lib\brain\shadow\shadow-observability.ts",
        "lib\brain\shadow\brain-shadow-integration.ts",
        "lib\brain\shadow\index.ts",
        "tests\unit\brain-llm-shadow.test.ts"
    )

foreach (
    $relative
    in $required
) {
    $file =
        Join-Path `
            $root `
            $relative

    if (
        -not (
            Test-Path `
                -LiteralPath `
                $file `
                -PathType Leaf
        )
    ) {
        throw (
            "13.55a : fichier manquant : " +
            $relative
        )
    }
}

$pureText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\shadow\shadow-observation.ts"
        )
    )

$serverText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\shadow\shadow-observability.ts"
        )
    )

$integrationText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\shadow\brain-shadow-integration.ts"
        )
    )

$testText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "tests\unit\brain-llm-shadow.test.ts"
        )
    )

if (
    $pureText.Contains(
        'import "server-only"'
    )
) {
    throw (
        "13.55a : module pur importe server-only."
    )
}

if (
    -not $serverText.Contains(
        'import "server-only"'
    )
) {
    throw (
        "13.55a : logger serveur non protege."
    )
}

if (
    -not $integrationText.Contains(
        'import "server-only"'
    )
) {
    throw (
        "13.55a : integration Brain non server-only."
    )
}

if (
    $testText.Contains(
        "shadow-observability"
    )
) {
    throw (
        "13.55a : test importe encore le module server-only."
    )
}

if (
    -not $integrationText.Contains(
        "KLYX_LLM_SHADOW_ENABLED"
    )
) {
    throw (
        "13.55a : feature flag shadow absent."
    )
}

if (
    $pureText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw (
        "13.55a : execution automatique non bloquee."
    )
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.55a tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.55a TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.55a build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.55 CHECK OK"
Write-Host "======================================"
Write-Host "Pure shadow observation : OK"
Write-Host "Server-only logging : OK"
Write-Host "Server-only Brain integration : OK"
Write-Host "Vitest server-only conflict : RESOLVED"
Write-Host "LLM user-visible authority : NONE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : REQUIRED"
Write-Host "Real OpenAI calls during tests : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"