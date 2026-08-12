$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "KLYX 12.66f - Shorthand conversationId Repair"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "assistant/market/page.tsx introuvable."
}

$content = [System.IO.File]::ReadAllText(
    $targetPath
)

if (-not $content.Contains(
    "KLYX_PUBLISH_PROOF_WIRING_12_66B"
)) {
    throw "Prerequis KLYX 12.66b introuvable."
}

$marker =
    "KLYX_PUBLISH_PROOF_SHORTHAND_REPAIR_12_66F"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.66f deja applique."
    exit 0
}

$spread =
    "...getKlyxPublishProof()"

if (-not $content.Contains($spread)) {
    throw "Spread getKlyxPublishProof introuvable."
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
            $spread,
            $searchPosition,
            [System.StringComparison]::Ordinal
        )

    if ($spreadIndex -lt 0) {
        break
    }

    # Retrouver le JSON.stringify parent.
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
        throw "Objet du payload introuvable."
    }

    $beforeSpread =
        $newContent.Substring(
            $objectOpen,
            $spreadIndex - $objectOpen
        )

    # IMPORTANT :
    # reconnait :
    #
    # conversationId,
    #
    # ET :
    #
    # conversationId: valeur,
    #
    $conversationPattern =
        '(?m)^\s*conversationId\s*(?:,|:)'

    $confirmationPattern =
        '(?m)^\s*confirmationId\s*(?:,|:)'

    $hasConversation =
        [regex]::IsMatch(
            $beforeSpread,
            $conversationPattern
        )

    $hasConfirmation =
        [regex]::IsMatch(
            $beforeSpread,
            $confirmationPattern
        )

    Write-Host ""
    Write-Host "Payload detecte :"
    Write-Host " conversationId deja present : $hasConversation"
    Write-Host " confirmationId deja present : $hasConfirmation"

    if (
        $hasConversation -and
        -not $hasConfirmation
    ) {
        # C'est exactement le cas TS2783 actuel.
        # conversationId est deja dans l'objet.
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
                $spread.Length
            )

        $repairCount++

        $searchPosition =
            $spreadIndex +
            $replacement.Length

        Write-Host " -> doublon conversationId supprime"
        Write-Host " -> confirmationId ajoute uniquement"

        continue
    }

    if (
        $hasConversation -and
        $hasConfirmation
    ) {
        # Les deux preuves sont deja presentes.
        # Le spread est inutile et provoque des doublons.

        $newContent =
            $newContent.Substring(
                0,
                $spreadIndex
            ) +
            $newContent.Substring(
                $spreadIndex +
                $spread.Length
            )

        $repairCount++

        $searchPosition =
            $spreadIndex

        Write-Host " -> conversationId deja present"
        Write-Host " -> confirmationId deja present"
        Write-Host " -> spread inutile supprime"

        continue
    }

    if (
        -not $hasConversation -and
        $hasConfirmation
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
                $spread.Length
            )

        $repairCount++

        $searchPosition =
            $spreadIndex +
            $replacement.Length

        Write-Host " -> conversationId ajoute uniquement"

        continue
    }

    # Aucun ID explicite avant le spread :
    # dans ce cas le spread complet reste legitime.
    Write-Host " -> spread complet conserve"

    $searchPosition =
        $spreadIndex +
        $spread.Length
}

if ($repairCount -lt 1) {
    throw "Aucun doublon de preuve repare."
}

# ============================================================
# Ajouter marqueur
# ============================================================

$payloadMarker =
    "// KLYX_PUBLISH_PROOF_PAYLOAD_12_66B"

$payloadIndex =
    $newContent.IndexOf(
        $payloadMarker
    )

if ($payloadIndex -lt 0) {
    throw "Marqueur payload 12.66b introuvable."
}

$newContent =
    $newContent.Substring(
        0,
        $payloadIndex
    ) +
    "// KLYX_PUBLISH_PROOF_SHORTHAND_REPAIR_12_66F" +
    $newLine +
    $newContent.Substring(
        $payloadIndex
    )

# ============================================================
# Verification
# ============================================================

if (-not $newContent.Contains($marker)) {
    throw "Marqueur 12.66f absent."
}

if (-not $newContent.Contains(
    "conversationId"
)) {
    throw "conversationId absent apres correction."
}

if (-not $newContent.Contains(
    "confirmationId"
)) {
    throw "confirmationId absent apres correction."
}

# ============================================================
# Backup + ecriture
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backup =
    "$targetPath.bak-12-66f-$timestamp"

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
Write-Host "OK - KLYX 12.66f applique."
Write-Host "OK - shorthand conversationId reconnu."
Write-Host "OK - doublon TS2783 corrige."
Write-Host ""