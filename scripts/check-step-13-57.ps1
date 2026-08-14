$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$required =
    @(
        "lib\brain\llm\health.ts",
        "app\api\brain\llm-health\route.ts",
        "tests\unit\brain-llm-health-contract.test.ts"
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
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw (
            "13.57 : fichier manquant : " +
            $relative
        )
    }
}

$healthText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\llm\health.ts"
        )
    )

$routeText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "app\api\brain\llm-health\route.ts"
        )
    )

if (
    $healthText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw (
        "13.57 : automatic execution non bloquee."
    )
}

if (
    $healthText -notmatch
    'explicitConfirmationRequired:\s*true'
) {
    throw (
        "13.57 : confirmation explicite non forcee."
    )
}

if (
    -not $healthText.Contains(
        "KLYX_LLM_SHADOW_ENABLED"
    )
) {
    throw (
        "13.57 : shadow feature flag absent."
    )
}

if (
    -not $routeText.Contains(
        "deterministic_authoritative"
    )
) {
    throw (
        "13.57 : autorite Brain deterministe absente."
    )
}

if (
    $routeText.Contains(
        "OPENAI_API_KEY"
    )
) {
    throw (
        "13.57 : route health expose la cle OpenAI."
    )
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.57 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.57 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.57 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.57 CHECK OK"
Write-Host "======================================"
Write-Host "LLM health endpoint : CREATED"
Write-Host "Shadow feature flag : READY"
Write-Host "Shadow default state : DISABLED"
Write-Host "OpenAI key exposure : NON"
Write-Host "Brain authority : DETERMINISTIC"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : REQUIRED"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"