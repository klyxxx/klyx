$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.51 - Brain Guided Completion"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_READINESS_12_50"
$marker = "KLYX_GUIDED_COMPLETION_12_51"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.50 introuvable. 12.51 ne sera pas applique."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.51 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"

$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$nextMissingAnchor = "nextMissing: nextMissingPart,"

$nextMissingIndex = $content.IndexOf(
    $nextMissingAnchor,
    $requestIndex
)

if ($nextMissingIndex -lt 0) {
    throw "Propriete nextMissing introuvable. Aucun fichier modifie."
}

$newLine = "`n"

if ($content.Contains("`r`n")) {
    $newLine = "`r`n"
}

$lineStart = $content.LastIndexOf("`n", $requestIndex)

if ($lineStart -lt 0) {
    $lineStart = 0
}
else {
    $lineStart++
}

$prefix = $content.Substring(
    $lineStart,
    $requestIndex - $lineStart
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

$questionLines = @(
    "$indent// KLYX_GUIDED_COMPLETION_12_51"
    "$indent" + 'const nextCompletionQuestion ='
    "$indent  " + 'nextMissingPart === "service"'
    "$indent    " + '? "Quel service te faut-il ? Tu peux aussi simplement décrire le problème."'
    "$indent    " + ': nextMissingPart === "ville"'
    "$indent      " + '? "Dans quelle ville as-tu besoin du service ?"'
    "$indent      " + ': nextMissingPart === "date"'
    "$indent        " + '? "Pour quelle date souhaites-tu ce service ?"'
    "$indent        " + ': nextMissingPart === "heure"'
    "$indent          " + '? "À quelle heure souhaites-tu ce service ?"'
    "$indent          " + ': null;'
    ""
)

$questionBlock = [string]::Join(
    $newLine,
    $questionLines
)

$newContent =
    $content.Substring(0, $requestIndex) +
    $questionBlock +
    $content.Substring($requestIndex)

$requestIndexAfterInsert = $newContent.IndexOf(
    $requestAnchor
)

if ($requestIndexAfterInsert -lt 0) {
    throw "requestReadiness perdu pendant la preparation. Aucun fichier modifie."
}

$nextMissingIndexAfterInsert = $newContent.IndexOf(
    $nextMissingAnchor,
    $requestIndexAfterInsert
)

if ($nextMissingIndexAfterInsert -lt 0) {
    throw "nextMissing perdu pendant la preparation. Aucun fichier modifie."
}

$propertyInsertPosition =
    $nextMissingIndexAfterInsert +
    $nextMissingAnchor.Length

$questionProperty =
    $newLine +
    $indent +
    "  question: nextCompletionQuestion,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $questionProperty +
    $newContent.Substring($propertyInsertPosition)

if (-not $newContent.Contains($marker)) {
    throw "Marqueur 12.51 absent avant ecriture."
}

if (-not $newContent.Contains("const nextCompletionQuestion =")) {
    throw "nextCompletionQuestion absent avant ecriture."
}

if (-not $newContent.Contains("question: nextCompletionQuestion,")) {
    throw "La question n'est pas rattachee a requestReadiness."
}

if (-not $newContent.Contains("KLYX_COMPLETENESS_12_49")) {
    throw "Protection echouee : KLYX 12.49 absent."
}

if (-not $newContent.Contains("KLYX_READINESS_12_50")) {
    throw "Protection echouee : KLYX 12.50 absent."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-51-$timestamp"

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

    if (-not $verification.Contains($marker)) {
        throw "Marqueur 12.51 absent apres ecriture."
    }

    if (-not $verification.Contains("const nextCompletionQuestion =")) {
        throw "Question guidee absente apres ecriture."
    }

    if (-not $verification.Contains("question: nextCompletionQuestion,")) {
        throw "requestReadiness ne contient pas la question."
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant 12.51."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.51 Brain Guided Completion ajoute."
Write-Host "OK - une seule prochaine question est determinee."
Write-Host "OK - demande complete = aucune question suivante."
Write-Host "OK - 12.49 et 12.50 conserves."
Write-Host "OK - aucune publication automatique ajoutee."
Write-Host "OK - aucune reservation automatique ajoutee."
Write-Host "OK - aucun paiement automatique ajoute."
Write-Host ""