$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.60 - Brain Visible Readiness"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$marker = "KLYX_VISIBLE_READINESS_12_60"

$requiredMarkers = @(
    "KLYX_COMPLETENESS_12_49",
    "KLYX_READINESS_12_50",
    "KLYX_GUIDED_COMPLETION_12_51",
    "KLYX_PROGRESS_FEEDBACK_12_52",
    "KLYX_REQUEST_SUMMARY_12_53",
    "KLYX_CONFIRMATION_GATE_12_54",
    "KLYX_CONFIRMATION_PROMPT_12_55",
    "KLYX_CONFIRMATION_CHOICES_12_56",
    "KLYX_CONFIRMATION_POLICY_12_57",
    "KLYX_ACTION_ELIGIBILITY_12_58",
    "KLYX_POST_CONFIRMATION_12_59"
)

foreach ($requiredMarker in $requiredMarkers) {
    if (-not $content.Contains($requiredMarker)) {
        throw "Prerequis absent : $requiredMarker. Aucun fichier modifie."
    }
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.60 est deja present. Aucune duplication."
    exit 0
}

$buildReplyStart = $content.IndexOf("function buildReply(")

if ($buildReplyStart -lt 0) {
    throw "function buildReply introuvable. Aucun fichier modifie."
}

$nextFunctionStart = $content.IndexOf(
    "async function insertBrainMessage",
    $buildReplyStart
)

if ($nextFunctionStart -lt 0) {
    throw "Fin securisee de buildReply introuvable. Aucun fichier modifie."
}

$buildReplyText = $content.Substring(
    $buildReplyStart,
    $nextFunctionStart - $buildReplyStart
)

$missingReturnAnchor = "return questions[missing[0]];"

$missingReturnRelativeIndex = $buildReplyText.IndexOf(
    $missingReturnAnchor
)

if ($missingReturnRelativeIndex -lt 0) {
    throw "Retour de question manquante introuvable. Aucun fichier modifie."
}

$missingReturnIndex =
    $buildReplyStart +
    $missingReturnRelativeIndex

$oldCompletePhrase =
    "Je peux maintenant chercher les meilleurs prestataires."

$completePhraseIndex = $content.IndexOf(
    $oldCompletePhrase,
    $buildReplyStart
)

if (
    $completePhraseIndex -lt 0 -or
    $completePhraseIndex -ge $nextFunctionStart
) {
    throw "Ancienne reponse complete introuvable dans buildReply. Aucun fichier modifie."
}

$tick = [char]96

$returnTemplateAnchor =
    "return " +
    $tick

$templateEndAnchor =
    [string]$tick +
    ";"

$completeReturnStart = $content.LastIndexOf(
    $returnTemplateAnchor,
    $completePhraseIndex
)

if (
    $completeReturnStart -lt $buildReplyStart -or
    $completeReturnStart -ge $nextFunctionStart
) {
    throw "Debut du retour complet introuvable. Aucun fichier modifie."
}

$completeReturnEndStart = $content.IndexOf(
    $templateEndAnchor,
    $completePhraseIndex
)

if (
    $completeReturnEndStart -lt 0 -or
    $completeReturnEndStart -ge $nextFunctionStart
) {
    throw "Fin du retour complet introuvable. Aucun fichier modifie."
}

$completeReturnEnd =
    $completeReturnEndStart +
    $templateEndAnchor.Length

$newLine = "`n"

if ($content.Contains("`r`n")) {
    $newLine = "`r`n"
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
        if ($char -eq " " -or $char -eq "`t") {
            $indent += $char
        }
        else {
            break
        }
    }

    return $indent
}

$missingIndent = Get-LineIndent `
    -Text $content `
    -Position $missingReturnIndex

$completeIndent = Get-LineIndent `
    -Text $content `
    -Position $completeReturnStart

$missingLines = @(
    ($missingIndent + "// KLYX_VISIBLE_READINESS_12_60")
    ($missingIndent + "const guidedQuestion =")
    ($missingIndent + "  nextCompletionQuestion ??")
    ($missingIndent + "  questions[missing[0]] ??")
    ($missingIndent + '  "Peux-tu préciser ta demande ?";')
    ""
    ($missingIndent + 'return `${completionStatusText}\n\n${guidedQuestion}`;')
)

$newMissingBlock = [string]::Join(
    $newLine,
    $missingLines
)

$completeLines = @(
    ($completeIndent + 'return `${completionStatusText}\n\n${')
    ($completeIndent + '  completionConfirmationText ?? "Demande prête."')
    ($completeIndent + '}\n\n${')
    ($completeIndent + '  completionConfirmationPrompt ??')
    ($completeIndent + '  "Vérifie la demande puis confirme avant de continuer."')
    ($completeIndent + '}`;')
)

$newCompleteBlock = [string]::Join(
    $newLine,
    $completeLines
)

# Modification de la zone la plus basse en premier
# afin de ne pas invalider les positions précédentes.

$newContent =
    $content.Substring(0, $completeReturnStart) +
    $newCompleteBlock +
    $content.Substring($completeReturnEnd)

# Recalcul de la position de buildReply apres premiere modification.

$buildReplyStart2 = $newContent.IndexOf(
    "function buildReply("
)

$nextFunctionStart2 = $newContent.IndexOf(
    "async function insertBrainMessage",
    $buildReplyStart2
)

$buildReplyText2 = $newContent.Substring(
    $buildReplyStart2,
    $nextFunctionStart2 - $buildReplyStart2
)

$missingReturnRelativeIndex2 = $buildReplyText2.IndexOf(
    $missingReturnAnchor
)

if ($missingReturnRelativeIndex2 -lt 0) {
    throw "Retour de question perdu avant ecriture."
}

$missingReturnIndex2 =
    $buildReplyStart2 +
    $missingReturnRelativeIndex2

$newContent =
    $newContent.Substring(0, $missingReturnIndex2) +
    $newMissingBlock +
    $newContent.Substring(
        $missingReturnIndex2 +
        $missingReturnAnchor.Length
    )

$requiredChecks = @(
    "KLYX_VISIBLE_READINESS_12_60",
    "const guidedQuestion =",
    'return `${completionStatusText}\n\n${guidedQuestion}`;',
    "completionConfirmationText",
    "completionConfirmationPrompt",
    "const automaticExecutionAllowed = false;"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

if ($newContent.Contains($oldCompletePhrase)) {
    throw "Ancienne reponse complete encore presente. Aucun fichier modifie."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-60-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backupPath `
    -Force

Write-Host "Sauvegarde : $backupPath"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $targetPath,
        $newContent,
        $utf8NoBom
    )

    $verification = [System.IO.File]::ReadAllText(
        $targetPath
    )

    foreach ($check in $requiredChecks) {
        if (-not $verification.Contains($check)) {
            throw "Verification apres ecriture echouee : $check"
        }
    }

    if ($verification.Contains($oldCompletePhrase)) {
        throw "Ancienne reponse complete toujours presente."
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.60."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.60 Brain Visible Readiness ajoute."
Write-Host "OK - progression visible dans la conversation."
Write-Host "OK - prochaine question guidee visible."
Write-Host "OK - resume visible quand demande complete."
Write-Host "OK - confirmation explicite visible."
Write-Host "OK - aucune action automatique ajoutee."
Write-Host ""