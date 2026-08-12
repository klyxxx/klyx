$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.52 - Brain Progress Feedback"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_GUIDED_COMPLETION_12_51"
$marker = "KLYX_PROGRESS_FEEDBACK_12_52"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.51 introuvable. 12.52 ne sera pas applique."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.52 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$questionAnchor = "question: nextCompletionQuestion,"
$questionIndex = $content.IndexOf(
    $questionAnchor,
    $requestIndex
)

if ($questionIndex -lt 0) {
    throw "question: nextCompletionQuestion introuvable. Aucun fichier modifie."
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

$lines = @()

$lines += "$indent// KLYX_PROGRESS_FEEDBACK_12_52"
$lines += $indent + 'const remainingCompletionCount = missingCompletionParts.length;'
$lines += ""
$lines += $indent + 'const completionStatusText = isRequestComplete'
$lines += $indent + '  ? `${completionLabel} (${completionScore} %)`'
$lines += $indent + '  : `${completionLabel} (${completionScore} %) - ${remainingCompletionCount} information${remainingCompletionCount > 1 ? "s" : ""} restante${remainingCompletionCount > 1 ? "s" : ""}`;'
$lines += ""

$block = [string]::Join($newLine, $lines)

$newContent =
    $content.Substring(0, $requestIndex) +
    $block +
    $content.Substring($requestIndex)

$requestIndexAfter = $newContent.IndexOf($requestAnchor)

if ($requestIndexAfter -lt 0) {
    throw "requestReadiness perdu pendant la preparation."
}

$questionIndexAfter = $newContent.IndexOf(
    $questionAnchor,
    $requestIndexAfter
)

if ($questionIndexAfter -lt 0) {
    throw "question perdue pendant la preparation."
}

$propertyInsertPosition =
    $questionIndexAfter +
    $questionAnchor.Length

$properties =
    $newLine +
    $indent +
    "  remainingCount: remainingCompletionCount," +
    $newLine +
    $indent +
    "  statusText: completionStatusText,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $properties +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_COMPLETENESS_12_49",
    "KLYX_READINESS_12_50",
    "KLYX_GUIDED_COMPLETION_12_51",
    "KLYX_PROGRESS_FEEDBACK_12_52",
    "const remainingCompletionCount = missingCompletionParts.length;",
    "const completionStatusText = isRequestComplete",
    "remainingCount: remainingCompletionCount,",
    "statusText: completionStatusText,"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-52-$timestamp"

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

    $verification = [System.IO.File]::ReadAllText($targetPath)

    foreach ($check in $requiredChecks) {
        if (-not $verification.Contains($check)) {
            throw "Verification apres ecriture echouee : $check"
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.52."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.52 Brain Progress Feedback ajoute."
Write-Host "OK - pourcentage conserve."
Write-Host "OK - nombre d informations restantes disponible."
Write-Host "OK - statusText disponible."
Write-Host "OK - confirmation utilisateur preservee."
Write-Host "OK - aucune publication automatique ajoutee."
Write-Host "OK - aucune reservation automatique ajoutee."
Write-Host "OK - aucun paiement automatique ajoute."
Write-Host ""