$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$comparison =
    Join-Path `
        $root `
        "lib\brain\shadow\shadow-comparison.ts"

$test =
    Join-Path `
        $root `
        "tests\unit\brain-shadow-comparison.test.ts"

$route =
    Join-Path `
        $root `
        "app\api\brain\respond\route.ts"

$envPath =
    Join-Path `
        $root `
        ".env.local"

foreach ($file in @(
    $comparison,
    $test,
    $route,
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
            "13.61 : fichier manquant : " +
            $file
        )
    }
}

$comparisonText =
    [System.IO.File]::ReadAllText(
        $comparison
    )

$routeText =
    [System.IO.File]::ReadAllText(
        $route
    )

$envText =
    [System.IO.File]::ReadAllText(
        $envPath
    )

if (
    $comparisonText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw "13.61 : automatic execution non bloquee."
}

if (
    $comparisonText -notmatch
    'canInfluenceUserReply:\s*false'
) {
    throw "13.61 : shadow peut influencer reply."
}

if (
    -not $routeText.Contains(
        "const reply = buildReply("
    )
) {
    throw "13.61 : Brain deterministe introuvable."
}

if (
    -not $routeText.Contains(
        "llmShadow: publicLlmShadow,"
    )
) {
    throw "13.61 : isolation shadow absente."
}

if (
    -not (
        [regex]::IsMatch(
            $envText,
            '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*0\s*$'
        )
    )
) {
    throw "13.61 : mode gratuit shadow=0 attendu."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.61 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.61 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.61 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.61 CHECK OK"
Write-Host "======================================"
Write-Host "Brain/LLM comparison engine : READY"
Write-Host "Shadow API calls : DISABLED"
Write-Host "Operating cost : ZERO"
Write-Host "Brain authority : DETERMINISTIC"
Write-Host "Shadow influence on reply : NONE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : REQUIRED"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"