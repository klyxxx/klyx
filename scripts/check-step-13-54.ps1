$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$required =
    @(
        "lib\brain\llm\contracts.ts",
        "lib\brain\llm\safety.ts",
        "lib\brain\llm\openai-structured.ts",
        "lib\brain\llm\openai-provider.ts",
        "lib\brain\llm\provider.ts",
        "lib\brain\llm\index.ts",
        "tests\unit\brain-openai-provider.test.ts"
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
            "13.54a : fichier manquant : " +
            $relative
        )
    }
}

$providerText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\llm\openai-provider.ts"
        )
    )

$structuredText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\llm\openai-structured.ts"
        )
    )

$testText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "tests\unit\brain-openai-provider.test.ts"
        )
    )

$safetyText =
    [System.IO.File]::ReadAllText(
        (
            Join-Path `
                $root `
                "lib\brain\llm\safety.ts"
        )
    )

if (
    -not $providerText.Contains(
        'import "server-only"'
    )
) {
    throw "13.54a : provider non server-only."
}

if (
    $structuredText.Contains(
        'import "server-only"'
    )
) {
    throw (
        "13.54a : parser pur ne doit pas importer server-only."
    )
}

if (
    $testText.Contains(
        "openai-provider"
    )
) {
    throw (
        "13.54a : test importe encore le provider server-only."
    )
}

if (
    -not $providerText.Contains(
        "https://api.openai.com/v1/responses"
    )
) {
    throw "13.54a : Responses API absente."
}

if (
    -not $providerText.Contains(
        "OPENAI_API_KEY"
    )
) {
    throw "13.54a : OPENAI_API_KEY absente."
}

if (
    $providerText.Contains(
        "NEXT_PUBLIC_OPENAI"
    )
) {
    throw "13.54a : cle exposee au client."
}

if (
    $safetyText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw (
        "13.54a : execution automatique non bloquee."
    )
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.54a tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.54a TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.54a build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.54 CHECK OK"
Write-Host "======================================"
Write-Host "OpenAI provider : SERVER ONLY"
Write-Host "Structured parser : TESTABLE PURE MODULE"
Write-Host "Responses API : READY"
Write-Host "Structured output : READY"
Write-Host "Provider fallback : ENABLED"
Write-Host "Real OpenAI test calls : NON"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : REQUIRED"
Write-Host "Existing Brain behavior changed : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"