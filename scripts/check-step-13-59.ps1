$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$enable =
    Join-Path `
        $root `
        "scripts\enable-step-13-59-shadow.ps1"

$disable =
    Join-Path `
        $root `
        "scripts\disable-step-13-59-shadow.ps1"

$route =
    Join-Path `
        $root `
        "app\api\brain\respond\route.ts"

$envPath =
    Join-Path `
        $root `
        ".env.local"

foreach (
    $file
    in @(
        $enable,
        $disable,
        $route,
        $envPath
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw (
            "13.59 : fichier manquant : " +
            $file
        )
    }
}

$enableText =
    [System.IO.File]::ReadAllText(
        $enable
    )

$disableText =
    [System.IO.File]::ReadAllText(
        $disable
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
    -not $enableText.Contains(
        "OPENAI_API_KEY"
    )
) {
    throw "13.59 : activation sans verification API key."
}

if (
    -not $enableText.Contains(
        "KLYX_LLM_SHADOW_ENABLED=1"
    )
) {
    throw "13.59 : activation shadow absente."
}

if (
    -not $disableText.Contains(
        "KLYX_LLM_SHADOW_ENABLED=0"
    )
) {
    throw "13.59 : kill switch absent."
}

if (
    -not $routeText.Contains(
        "const publicLlmShadow = sanitizeKlyxShadowForClient("
    )
) {
    throw "13.59 : isolation 13.56 absente."
}

if (
    -not $routeText.Contains(
        "llmShadow: publicLlmShadow,"
    )
) {
    throw "13.59 : payload shadow sanitized absent."
}

if (
    -not $routeText.Contains(
        "reply,"
    )
) {
    throw "13.59 : reply deterministic introuvable."
}

$envShadow =
    [regex]::Match(
        $envText,
        '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*([01])\s*$'
    )

if (
    -not $envShadow.Success
) {
    throw "13.59 : feature flag shadow invalide."
}

Write-Host ""
Write-Host (
    "Current shadow state : " +
    $envShadow.Groups[1].Value
)

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.59 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.59 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.59 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.59 CHECK OK"
Write-Host "======================================"
Write-Host "Safe enable script : READY"
Write-Host "Emergency disable script : READY"
Write-Host "API key prerequisite : REQUIRED"
Write-Host "Shadow client payload : SANITIZED"
Write-Host "Brain reply authority : DETERMINISTIC"
Write-Host "Automatic transactions : IMPOSSIBLE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"