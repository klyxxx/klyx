$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "KLYX 12.66b - Publish Proof Wiring Repair"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "app/assistant/market/page.tsx introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

if (-not $content.Contains(
    "/api/brain/market-publish"
)) {
    throw "Appel /api/brain/market-publish introuvable."
}

$marker = "KLYX_PUBLISH_PROOF_WIRING_12_66B"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.66b deja applique."
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

    for (
        $i = $OpenIndex;
        $i -lt $Text.Length;
        $i++
    ) {
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

function Get-LineIndent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$Position
    )

    $lineStart = $Text.LastIndexOf(
        "`n",
        $Position
    )

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart++
    }

    $prefix = $Text.Substring(
        $lineStart,
        $Position - $lineStart
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

    return $indent
}

function Count-Literal {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $count = 0
    $position = 0

    while ($true) {
        $index = $Text.IndexOf(
            $Value,
            $position,
            [System.StringComparison]::Ordinal
        )

        if ($index -lt 0) {
            break
        }

        $count++
        $position =
            $index + $Value.Length
    }

    return $count
}

$newContent = $content

# ============================================================
# 1. Helper unique pour récupérer la preuve de l'URL
# ============================================================

$functionIndex =
    $newContent.IndexOf(
        "function "
    )

if ($functionIndex -lt 0) {
    throw "Premiere fonction du composant introuvable."
}

$functionLineStart =
    $newContent.LastIndexOf(
        "`n",
        $functionIndex
    )

if ($functionLineStart -lt 0) {
    $functionLineStart = 0
}
else {
    $functionLineStart++
}

$helperLines = @(
    "// KLYX_PUBLISH_PROOF_WIRING_12_66B"
    "function getKlyxPublishProof() {"
    '  if (typeof window === "undefined") {'
    "    return {"
    "      conversationId: null,"
    "      confirmationId: null,"
    "    };"
    "  }"
    ""
    "  const params = new URLSearchParams("
    "    window.location.search"
    "  );"
    ""
    "  return {"
    "    conversationId:"
    '      params.get("conversationId"),'
    "    confirmationId:"
    '      params.get("confirmationId"),'
    "  };"
    "}"
    ""
)

$helperBlock = [string]::Join(
    $newLine,
    $helperLines
)

$newContent =
    $newContent.Substring(
        0,
        $functionLineStart
    ) +
    $helperBlock +
    $newContent.Substring(
        $functionLineStart
    )

# ============================================================
# 2. Injecter la preuve à la FIN de chaque payload market-publish
# ============================================================

$endpoint =
    "/api/brain/market-publish"

$searchPosition = 0
$patchedCount = 0

while ($true) {
    $endpointIndex =
        $newContent.IndexOf(
            $endpoint,
            $searchPosition,
            [System.StringComparison]::Ordinal
        )

    if ($endpointIndex -lt 0) {
        break
    }

    $jsonIndex =
        $newContent.IndexOf(
            "JSON.stringify(",
            $endpointIndex,
            [System.StringComparison]::Ordinal
        )

    if ($jsonIndex -lt 0) {
        throw "JSON.stringify associe a market-publish introuvable."
    }

    if (
        ($jsonIndex - $endpointIndex) -gt 8000
    ) {
        throw "JSON.stringify market-publish trop eloigne."
    }

    $jsonOpen =
        $jsonIndex +
        "JSON.stringify(".Length

    while (
        $jsonOpen -lt $newContent.Length -and
        [char]::IsWhiteSpace(
            $newContent[$jsonOpen]
        )
    ) {
        $jsonOpen++
    }

    if (
        $jsonOpen -ge $newContent.Length -or
        $newContent[$jsonOpen] -ne "{"
    ) {
        throw "Le body market-publish n'utilise pas JSON.stringify({ ... })."
    }

    $jsonClose =
        Find-MatchingBrace `
            -Text $newContent `
            -OpenIndex $jsonOpen

    if ($jsonClose -lt 0) {
        throw "Fin du payload market-publish introuvable."
    }

    $objectText =
        $newContent.Substring(
            $jsonOpen,
            $jsonClose - $jsonOpen + 1
        )

    if ($objectText.Contains(
        "KLYX_PUBLISH_PROOF_PAYLOAD_12_66B"
    )) {
        $searchPosition =
            $jsonClose + 1

        continue
    }

    $cursor =
        $jsonClose - 1

    while (
        $cursor -gt $jsonOpen -and
        [char]::IsWhiteSpace(
            $newContent[$cursor]
        )
    ) {
        $cursor--
    }

    $needsComma = (
        $newContent[$cursor] -ne "{" -and
        $newContent[$cursor] -ne ","
    )

    $closeIndent =
        Get-LineIndent `
            -Text $newContent `
            -Position $jsonClose

    $propertyIndent =
        $closeIndent + "  "

    $proofLines = @(
        ""
        ($propertyIndent + "// KLYX_PUBLISH_PROOF_PAYLOAD_12_66B")
        ($propertyIndent + "...getKlyxPublishProof()")
    )

    $proofBlock =
        [string]::Join(
            $newLine,
            $proofLines
        )

    if ($needsComma) {
        $proofBlock =
            "," + $proofBlock
    }

    $newContent =
        $newContent.Substring(
            0,
            $jsonClose
        ) +
        $proofBlock +
        $newContent.Substring(
            $jsonClose
        )

    $patchedCount++

    $searchPosition =
        $jsonClose +
        $proofBlock.Length +
        1
}

if ($patchedCount -lt 1) {
    throw "Aucun payload market-publish modifie."
}

# ============================================================
# 3. Vérifications
# ============================================================

$endpointCount =
    Count-Literal `
        -Text $newContent `
        -Value $endpoint

$payloadMarkerCount =
    Count-Literal `
        -Text $newContent `
        -Value "KLYX_PUBLISH_PROOF_PAYLOAD_12_66B"

Write-Host "Appels market-publish : $endpointCount"
Write-Host "Payloads cables       : $payloadMarkerCount"

if ($payloadMarkerCount -lt $endpointCount) {
    throw "Tous les appels market-publish ne sont pas cables."
}

$checks = @(
    "KLYX_PUBLISH_PROOF_WIRING_12_66B",
    "function getKlyxPublishProof()",
    'params.get("conversationId")',
    'params.get("confirmationId")',
    "KLYX_PUBLISH_PROOF_PAYLOAD_12_66B",
    "...getKlyxPublishProof()"
)

foreach ($check in $checks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification echouee : $check"
    }
}

# ============================================================
# 4. Backup + écriture
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backupPath =
    "$targetPath.bak-12-66b-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backupPath `
    -Force

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
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.66b applique."
Write-Host "OK - conversationId cable."
Write-Host "OK - confirmationId cable."
Write-Host "OK - market-publish recoit la preuve."
Write-Host ""