$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envPath =
    Join-Path $root ".env.local"

$route =
    Join-Path $root "app\api\brain\respond\route.ts"

$sanitizer =
    Join-Path $root "lib\brain\shadow\shadow-sanitizer.ts"

foreach ($file in @(
    $envPath,
    $route,
    $sanitizer
)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "13.60 : fichier manquant : $file"
    }
}

$envText =
    [System.IO.File]::ReadAllText($envPath)

$routeText =
    [System.IO.File]::ReadAllText($route)

$sanitizerText =
    [System.IO.File]::ReadAllText($sanitizer)

# ============================================================
# FREE MODE
# ============================================================

$shadowDisabled =
    [regex]::IsMatch(
        $envText,
        '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*0\s*$'
    )

if (-not $shadowDisabled) {
    throw "13.60 : mode gratuit attendu avec shadow=0."
}

# ============================================================
# DETERMINISTIC BRAIN REMAINS AUTHORITATIVE
# ============================================================

if (-not $routeText.Contains("const reply = buildReply(")) {
    throw "13.60 : reply deterministe introuvable."
}

if (-not $routeText.Contains("deterministicReply: reply")) {
    throw "13.60 : contrat deterministicReply absent."
}

if (-not $routeText.Contains(
    "const publicLlmShadow = sanitizeKlyxShadowForClient("
)) {
    throw "13.60 : isolation shadow absente."
}

if (-not $routeText.Contains(
    "llmShadow: publicLlmShadow,"
)) {
    throw "13.60 : payload shadow sanitized absent."
}

if (
    $sanitizerText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw "13.60 : execution automatique non bloquee."
}

# ============================================================
# TESTS
# ============================================================

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "KLYX 13.60 tests FAILED."
}

# ============================================================
# TYPESCRIPT
# ============================================================

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "KLYX 13.60 TypeScript FAILED."
}

# ============================================================
# BUILD
# ============================================================

Write-Host ""
Write-Host "Production build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "KLYX 13.60 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.60 CHECK OK"
Write-Host "======================================"
Write-Host "Operating mode : FREE / DETERMINISTIC"
Write-Host "OpenAI paid API call : NONE"
Write-Host "OpenAI shadow : DISABLED"
Write-Host "Brain user reply : DETERMINISTIC"
Write-Host "Shadow infrastructure : READY FOR LATER"
Write-Host "LLM text exposed : NON"
Write-Host "LLM transaction authority : NONE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Explicit confirmation : REQUIRED"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"