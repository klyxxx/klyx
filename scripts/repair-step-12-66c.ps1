$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "KLYX 12.66c - Publish Proof TypeScript Repair"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "app/assistant/market/page.tsx introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

if (-not $content.Contains(
    "/api/brain/market-publish"
)) {
    throw "market-publish introuvable."
}

if (-not $content.Contains(
    "KLYX_PUBLISH_PROOF_WIRING_12_66B"
)) {
    throw "Prerequis KLYX 12.66b introuvable."
}

$marker = "KLYX_PUBLISH_PROOF_WIRING_12_66C"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.66c deja applique."
    exit 0
}

$newLine = if ($content.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

function Find-MatchingBrace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$OpenIndex
    )

    $depth = 0
    $quote = [char]0
    $escaped = $false

    for ($i = $OpenIndex; $i -lt $Text.Length; $i++) {
        $char = $Text[$i]

        if ($quote -ne [char]0) {
            if ($escaped) {
                $escaped = $false
                continue
            }

            if ($char -eq "\") {
                $escaped = $true
                continue
            }

            if ($char -eq $quote) {
                $quote = [char]0
            }

            continue
        }

        if (
            $char -eq "'" -or
            $char -eq '"' -or
            $char -eq '`'
        ) {
            $quote = $char
            continue
        }

        if ($char -eq "{") {
            $depth++
            continue
        }

        if ($char -eq "}") {
            $depth--

            if ($depth -eq 0) {
                return $i
            }
        }
    }

    return -1
}

# ============================================================
# 1. Trouver le vrai useSearchParams() de la page
# ============================================================

$searchParamsMatch =
    [regex]::Match(
        $content,
        'const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*useSearchParams\(\s*\)\s*;'
    )

if (-not $searchParamsMatch.Success) {
    throw "useSearchParams() introuvable dans assistant/market/page.tsx."
}

$searchParamsName =
    $searchParamsMatch.Groups[1].Value

Write-Host "useSearchParams detecte : $searchParamsName"

$newContent = $content

# ============================================================
# 2. Retirer le helper window de 12.66b
# ============================================================

$helperToken =
    "function getKlyxPublishProof()"

$helperIndex =
    $newContent.IndexOf($helperToken)

if ($helperIndex -lt 0) {
    throw "getKlyxPublishProof() introuvable."
}

$helperLineStart =
    $newContent.LastIndexOf(
        "`n",
        $helperIndex
    )

if ($helperLineStart -lt 0) {
    $helperLineStart = 0
}
else {
    $helperLineStart++
}

$helperOpen =
    $newContent.IndexOf(
        "{",
        $helperIndex
    )

if ($helperOpen -lt 0) {
    throw "Ouverture getKlyxPublishProof introuvable."
}

$helperClose =
    Find-MatchingBrace `
        -Text $newContent `
        -OpenIndex $helperOpen

if ($helperClose -lt 0) {
    throw "Fin getKlyxPublishProof introuvable."
}

$removeEnd =
    $helperClose + 1

while (
    $removeEnd -lt $newContent.Length -and
    (
        $newContent[$removeEnd] -eq "`r" -or
        $newContent[$removeEnd] -eq "`n"
    )
) {
    $removeEnd++
}

$newContent =
    $newContent.Substring(
        0,
        $helperLineStart
    ) +
    $newContent.Substring(
        $removeEnd
    )

# ============================================================
# 3. Remplacer le spread par les paramètres Next.js
# ============================================================

$oldSpread =
    "...getKlyxPublishProof()"

$spreadCount = 0
$position = 0

while ($true) {
    $index =
        $newContent.IndexOf(
            $oldSpread,
            $position,
            [System.StringComparison]::Ordinal
        )

    if ($index -lt 0) {
        break
    }

    $lineStart =
        $newContent.LastIndexOf(
            "`n",
            $index
        )

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart++
    }

    $prefix =
        $newContent.Substring(
            $lineStart,
            $index - $lineStart
        )

    $indent = ""

    foreach ($char in $prefix.ToCharArray()) {
        if (
            $char -eq " " -or
            $char -eq "`t"
        ) {
            $indent += $char
        }
        else {
            break
        }
    }

    $replacementLines = @(
        "conversationId:"
        ($indent + "  " + $searchParamsName + '.get("conversationId"),')
        ($indent + "confirmationId:")
        ($indent + "  " + $searchParamsName + '.get("confirmationId")')
    )

    $replacement =
        [string]::Join(
            $newLine,
            $replacementLines
        )

    $newContent =
        $newContent.Substring(
            0,
            $index
        ) +
        $replacement +
        $newContent.Substring(
            $index + $oldSpread.Length
        )

    $spreadCount++

    $position =
        $index +
        $replacement.Length
}

if ($spreadCount -lt 1) {
    throw "Aucun getKlyxPublishProof() remplace."
}

# ============================================================
# 4. Ajouter marqueur 12.66c
# ============================================================

$payloadMarker =
    "// KLYX_PUBLISH_PROOF_PAYLOAD_12_66B"

$payloadIndex =
    $newContent.IndexOf($payloadMarker)

if ($payloadIndex -lt 0) {
    throw "Marqueur payload 12.66b introuvable."
}

$newContent =
    $newContent.Substring(
        0,
        $payloadIndex
    ) +
    "// KLYX_PUBLISH_PROOF_WIRING_12_66C" +
    $newLine +
    $newContent.Substring(
        $payloadIndex
    )

# ============================================================
# 5. Verification
# ============================================================

$checks = @(
    "KLYX_PUBLISH_PROOF_WIRING_12_66C",
    'get("conversationId")',
    'get("confirmationId")',
    "/api/brain/market-publish"
)

foreach ($check in $checks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification echouee : $check"
    }
}

if ($newContent.Contains(
    "getKlyxPublishProof()"
)) {
    throw "Ancien helper 12.66b encore present."
}

if ($newContent.Contains(
    'typeof window !== "undefined"'
)) {
    throw "Ancienne dependance window encore presente."
}

# ============================================================
# 6. Backup + ecriture
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backup =
    "$targetPath.bak-12-66c-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backup `
    -Force

Write-Host "Backup : $backup"

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $targetPath,
        $newContent,
        $utf8NoBom
    )
}
catch {
    Copy-Item `
        -LiteralPath $backup `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.66c applique."
Write-Host "OK - window supprime."
Write-Host "OK - useSearchParams utilise."
Write-Host "OK - conversationId transmis."
Write-Host "OK - confirmationId transmis."
Write-Host ""