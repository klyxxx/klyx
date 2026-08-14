$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envPath =
    Join-Path $root ".env.local"

$routePath =
    Join-Path $root "app\api\brain\respond\route.ts"

$healthPath =
    Join-Path $root "app\api\brain\llm-health\route.ts"

$sanitizerPath =
    Join-Path $root "lib\brain\shadow\shadow-sanitizer.ts"

foreach ($file in @(
    $envPath,
    $routePath,
    $healthPath,
    $sanitizerPath
)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "13.60 : fichier manquant : $file"
    }
}

$envText =
    [System.IO.File]::ReadAllText($envPath)

$routeText =
    [System.IO.File]::ReadAllText($routePath)

$healthText =
    [System.IO.File]::ReadAllText($healthPath)

$sanitizerText =
    [System.IO.File]::ReadAllText($sanitizerPath)

# ============================================================
# SHADOW FLAG
# ============================================================

$enabledCount =
    [regex]::Matches(
        $envText,
        '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*1\s*$'
    ).Count

if ($enabledCount -ne 1) {
    throw "13.60 : KLYX_LLM_SHADOW_ENABLED=1 attendu exactement une fois."
}

# ============================================================
# OPENAI KEY
# Never print the value.
# ============================================================

$keyMatch =
    [regex]::Match(
        $envText,
        '(?m)^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$'
    )

if (-not $keyMatch.Success) {
    throw "13.60 : OPENAI_API_KEY absente."
}

$keyValue =
    $keyMatch.Groups[1].Value.Trim()

if ([string]::IsNullOrWhiteSpace($keyValue)) {
    throw "13.60 : OPENAI_API_KEY vide."
}

if (-not $keyValue.StartsWith("sk-")) {
    throw "13.60 : OPENAI_API_KEY invalide."
}

$keyValue = $null

# ============================================================
# DETERMINISTIC BRAIN MUST REMAIN AUTHORITATIVE
# ============================================================

if (-not $routeText.Contains("const reply = buildReply(")) {
    throw "13.60 : reply deterministe introuvable."
}

if (-not $routeText.Contains("deterministicReply: reply")) {
    throw "13.60 : shadow ne recoit pas la reply deterministe."
}

if (-not $routeText.Contains(
    "const publicLlmShadow = sanitizeKlyxShadowForClient("
)) {
    throw "13.60 : sanitizer shadow absent."
}

if (-not $routeText.Contains(
    "llmShadow: publicLlmShadow,"
)) {
    throw "13.60 : payload shadow sanitized absent."
}

# ============================================================
# VERIFY BRAIN RESPONSE OBJECT
# ============================================================

$returnMatches =
    [regex]::Matches(
        $routeText,
        '(?s)return\s+NextResponse\.json\(\s*\{(.*?)\}\s*\);'
    )

if ($returnMatches.Count -lt 1) {
    throw "13.60 : aucun NextResponse.json trouve."
}

$brainReturnFound = $false

foreach ($m in $returnMatches) {
    $body = $m.Groups[1].Value

    if (
        [regex]::IsMatch(
            $body,
            '(?m)^\s*conversationId,\s*$'
        ) -and
        [regex]::IsMatch(
            $body,
            '(?m)^\s*reply,\s*$'
        ) -and
        [regex]::IsMatch(
            $body,
            '(?m)^\s*payload,\s*$'
        )
    ) {
        $brainReturnFound = $true

        if (
            [regex]::IsMatch(
                $body,
                '(?i)reply\s*:\s*.*llm'
            )
        ) {
            throw "13.60 : SECURITY FAILURE - reply liee au LLM."
        }

        break
    }
}

if (-not $brainReturnFound) {
    throw "13.60 : retour Brain deterministe attendu introuvable."
}

# ============================================================
# NO TRANSACTIONAL AUTHORITY FROM SHADOW
# ============================================================

$dangerPatterns = @(
    '(?s)llmShadow.{0,200}create_booking',
    '(?s)llmShadow.{0,200}create_payment',
    '(?s)llmShadow.{0,200}publish_market',
    '(?s)llmShadow.{0,200}select_provider',
    '(?s)publicLlmShadow.{0,200}create_booking',
    '(?s)publicLlmShadow.{0,200}create_payment',
    '(?s)publicLlmShadow.{0,200}publish_market',
    '(?s)publicLlmShadow.{0,200}select_provider'
)

foreach ($pattern in $dangerPatterns) {
    if (
        [regex]::IsMatch(
            $routeText,
            $pattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    ) {
        throw "13.60 : couplage transactionnel shadow detecte."
    }
}

# ============================================================
# SANITIZER SAFETY
# ============================================================

if (
    $sanitizerText -notmatch
    'automaticExecutionAllowed:\s*false'
) {
    throw "13.60 : automaticExecutionAllowed=false absent."
}

if (
    -not $sanitizerText.Contains(
        "internalTextExposed:"
    )
) {
    throw "13.60 : protection internalTextExposed absente."
}

# ============================================================
# HEALTH ENDPOINT SAFETY
# ============================================================

if (
    -not $healthText.Contains(
        "deterministic_authoritative"
    )
) {
    throw "13.60 : autorite deterministe absente du health endpoint."
}

if ($healthText.Contains("OPENAI_API_KEY")) {
    throw "13.60 : health endpoint reference OPENAI_API_KEY."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.60 RUNTIME SAFETY OK"
Write-Host "======================================"
Write-Host "Shadow local : ENABLED"
Write-Host "OPENAI_API_KEY : CONFIGURED"
Write-Host "Secret printed : NON"
Write-Host "Brain authority : DETERMINISTIC"
Write-Host "LLM reply authority : NONE"
Write-Host "Shadow payload : SANITIZED"
Write-Host "Transactional coupling : NONE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "======================================"