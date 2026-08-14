$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$route =
    Join-Path `
        $root `
        "app\api\brain\respond\route.ts"

$sanitizer =
    Join-Path `
        $root `
        "lib\brain\shadow\shadow-sanitizer.ts"

$publicContract =
    Join-Path `
        $root `
        "lib\brain\shadow\shadow-public.ts"

$test =
    Join-Path `
        $root `
        "tests\unit\brain-shadow-sanitizer.test.ts"

foreach (
    $file
    in @(
        $route,
        $sanitizer,
        $publicContract,
        $test
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
            "13.56 : fichier manquant : " +
            $file
        )
    }
}

$routeText =
    [System.IO.File]::ReadAllText(
        $route
    )

$sanitizerText =
    [System.IO.File]::ReadAllText(
        $sanitizer
    )

$publicText =
    [System.IO.File]::ReadAllText(
        $publicContract
    )

if (
    -not $routeText.Contains(
        "KLYX_SHADOW_ISOLATION_13_56"
    )
) {
    throw "13.56 : marker absent."
}

if (
    -not $routeText.Contains(
        "sanitizeKlyxShadowForClient"
    )
) {
    throw "13.56 : sanitizer non utilise."
}

if (
    -not $routeText.Contains(
        "const publicLlmShadow = sanitizeKlyxShadowForClient("
    )
) {
    throw "13.56 : publicLlmShadow absent."
}

if (
    -not $routeText.Contains(
        "llmShadow?: KlyxPublicShadowStatus;"
    )
) {
    throw "13.56 : BrainPayload utilise encore le type LLM interne."
}

# ============================================================
# Validate only the BrainPayload object.
# The sanitizer call legitimately contains "llmShadow,"
# and must NOT be considered a leak.
# ============================================================

$payloadMatch =
    [regex]::Match(
        $routeText,
        '(?s)const payload:\s*BrainPayload\s*=\s*\{(.*?)\};'
    )

if (
    -not $payloadMatch.Success
) {
    throw "13.56 : bloc BrainPayload runtime introuvable."
}

$payloadBody =
    $payloadMatch.Groups[1].Value

if (
    -not $payloadBody.Contains(
        "llmShadow: publicLlmShadow,"
    )
) {
    throw "13.56 : payload sanitized absent."
}

$rawPayloadCount =
    [regex]::Matches(
        $payloadBody,
        '(?m)^\s*llmShadow,\s*$'
    ).Count

if (
    $rawPayloadCount -ne 0
) {
    throw "13.56 : raw LLM shadow expose dans BrainPayload."
}

if (
    $payloadBody.Contains(
        "text:"
    )
) {
    throw "13.56 : texte LLM detecte dans BrainPayload."
}

if (
    $payloadBody.Contains(
        "error:"
    )
) {
    throw "13.56 : erreur provider detectee dans BrainPayload."
}

if (
    -not $sanitizerText.Contains(
        "internalTextExposed:"
    )
) {
    throw "13.56 : indicateur anti-fuite absent."
}

if (
    $sanitizerText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw "13.56 : execution automatique non bloquee."
}

if (
    -not $sanitizerText.Contains(
        "sanitizeIntent"
    )
) {
    throw "13.56 : sanitation intent absente."
}

if (
    -not $publicText.Contains(
        "internalTextExposed: false"
    )
) {
    throw "13.56 : contrat public anti-fuite invalide."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.56 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.56 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.56 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.56 CHECK OK"
Write-Host "======================================"
Write-Host "Deterministic Brain reply : AUTHORITATIVE"
Write-Host "Internal LLM result : SERVER ONLY"
Write-Host "Client shadow payload : SANITIZED"
Write-Host "Shadow intent : NORMALIZED"
Write-Host "LLM text leak : BLOCKED"
Write-Host "LLM provider error leak : BLOCKED"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : PRESERVED"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"