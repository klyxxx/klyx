$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "KLYX 12.66e - Duplicate Proof Repair"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "assistant/market/page.tsx introuvable."
}

$content =
    [System.IO.File]::ReadAllText(
        $targetPath
    )

if (-not $content.Contains(
    "KLYX_PUBLISH_PROOF_WIRING_12_66B"
)) {
    throw "Prerequis KLYX 12.66b introuvable."
}

if (-not $content.Contains(
    "...getKlyxPublishProof()"
)) {
    throw "Spread getKlyxPublishProof introuvable."
}

$marker =
    "KLYX_PUBLISH_PROOF_DUPLICATE_REPAIR_12_66E"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.66e deja applique."
    exit 0
}

$newLine = if ($content.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

$newContent = $content
$searchPosition = 0
$repairCount = 0

while ($true) {

    $spreadIndex =
        $newContent.IndexOf(
            "...getKlyxPublishProof()",
            $searchPosition,
            [System.StringComparison]::Ordinal
        )

    if ($spreadIndex -lt 0) {
        break
    }

    # Retrouver le JSON.stringify correspondant.
    $jsonIndex =
        $newContent.LastIndexOf(
            "JSON.stringify(",
            $spreadIndex,
            [System.StringComparison]::Ordinal
        )

    if ($jsonIndex -lt 0) {
        throw "JSON.stringify parent introuvable."
    }

    $objectOpen =
        $newContent.IndexOf(
            "{",
            $jsonIndex
        )

    if (
        $objectOpen -lt 0 -or
        $objectOpen -gt $spreadIndex
    ) {
        throw "Objet JSON parent introuvable."
    }

    $beforeSpread =
        $newContent.Substring(
            $objectOpen,
            $spreadIndex - $objectOpen
        )

    $hasConversationId =
        [regex]::IsMatch(
            $beforeSpread,
            '(?m)^\s*conversationId\s*:'
        )

    $hasConfirmationId =
        [regex]::IsMatch(
            $beforeSpread,
            '(?m)^\s*confirmationId\s*:'
        )

    Write-Host ""
    Write-Host "Payload market-publish detecte :"
    Write-Host " conversationId existant : $hasConversationId"
    Write-Host " confirmationId existant : $hasConfirmationId"

    if (
        $hasConversationId -and
        -not $hasConfirmationId
    ) {
        # Cas actuel :
        # conversationId existe deja.
        # On ajoute seulement confirmationId.

        $replacement =
            "confirmationId: getKlyxPublishProof().confirmationId"

        $newContent =
            $newContent.Substring(
                0,
                $spreadIndex
            ) +
            $replacement +
            $newContent.Substring(
                $spreadIndex +
                "...getKlyxPublishProof()".Length
            )

        $searchPosition =
            $spreadIndex +
            $replacement.Length

        $repairCount++

        Write-Host " -> conservation conversationId existant"
        Write-Host " -> ajout confirmationId uniquement"
    }
    elseif (
        -not $hasConversationId -and
        $hasConfirmationId
    ) {
        $replacement =
            "conversationId: getKlyxPublishProof().conversationId"

        $newContent =
            $newContent.Substring(
                0,
                $spreadIndex
            ) +
            $replacement +
            $newContent.Substring(
                $spreadIndex +
                "...getKlyxPublishProof()".Length
            )

        $searchPosition =
            $spreadIndex +
            $replacement.Length

        $repairCount++

        Write-Host " -> conservation confirmationId existant"
        Write-Host " -> ajout conversationId uniquement"
    }
    elseif (
        $hasConversationId -and
        $hasConfirmationId
    ) {
        # Les deux existent deja.
        # Le spread devient inutile.

        $newContent =
            $newContent.Substring(
                0,
                $spreadIndex
            ) +
            $newContent.Substring(
                $spreadIndex +
                "...getKlyxPublishProof()".Length
            )

        $searchPosition =
            $spreadIndex

        $repairCount++

        Write-Host " -> les deux preuves existaient deja"
        Write-Host " -> spread duplique supprime"
    }
    else {
        # Aucun des deux n'existe.
        # Dans ce cas le spread est correct.
        $searchPosition =
            $spreadIndex +
            "...getKlyxPublishProof()".Length

        Write-Host " -> spread complet conserve"
    }
}

if ($repairCount -lt 1) {
    throw "Aucun doublon de preuve repare."
}

# Ajouter marqueur juste avant le premier payload 12.66b.

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
    "// KLYX_PUBLISH_PROOF_DUPLICATE_REPAIR_12_66E" +
    $newLine +
    $newContent.Substring(
        $payloadIndex
    )

# ============================================================
# Verification
# ============================================================

if (-not $newContent.Contains($marker)) {
    throw "Marqueur 12.66e absent."
}

if (-not $newContent.Contains(
    "conversationId"
)) {
    throw "conversationId absent."
}

if (-not $newContent.Contains(
    "confirmationId"
)) {
    throw "confirmationId absent."
}

if ($newContent.Contains(
    "...getKlyxPublishProof()"
)) {
    Write-Host ""
    Write-Host "ATTENTION : un spread complet subsiste."
    Write-Host "Il appartient a un payload sans IDs explicites."
}

# ============================================================
# Backup
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backup =
    "$targetPath.bak-12-66e-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backup `
    -Force

Write-Host ""
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
Write-Host "OK - KLYX 12.66e applique."
Write-Host "OK - doublon conversationId supprime."
Write-Host "OK - confirmationId conserve."
Write-Host ""