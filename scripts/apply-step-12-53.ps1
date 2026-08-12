$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.53 - Brain Request Summary"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_PROGRESS_FEEDBACK_12_52"
$marker = "KLYX_REQUEST_SUMMARY_12_53"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.52 introuvable. 12.53 ne sera pas applique."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.53 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$statusAnchor = "statusText: completionStatusText,"
$statusIndex = $content.IndexOf(
    $statusAnchor,
    $requestIndex
)

if ($statusIndex -lt 0) {
    throw "statusText de 12.52 introuvable. Aucun fichier modifie."
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

$lines = @(
    "$indent// KLYX_REQUEST_SUMMARY_12_53"
    "$indent" + 'const completionRequestSummary = isRequestComplete'
    "$indent  " + '? {'
    "$indent      " + 'service: context.serviceSlug,'
    "$indent      " + 'city: context.city,'
    "$indent      " + 'date: context.date,'
    "$indent      " + 'time: context.time,'
    "$indent    " + '}'
    "$indent  " + ': null;'
    ""
    "$indent" + 'const completionConfirmationText = isRequestComplete'
    "$indent  " + '? `Service: ${context.serviceSlug} | Ville: ${context.city} | Date: ${context.date} | Heure: ${context.time}`'
    "$indent  " + ': null;'
    ""
)

$block = [string]::Join($newLine, $lines)

$newContent =
    $content.Substring(0, $requestIndex) +
    $block +
    $content.Substring($requestIndex)

$requestIndexAfter = $newContent.IndexOf($requestAnchor)

if ($requestIndexAfter -lt 0) {
    throw "requestReadiness perdu pendant la preparation."
}

$statusIndexAfter = $newContent.IndexOf(
    $statusAnchor,
    $requestIndexAfter
)

if ($statusIndexAfter -lt 0) {
    throw "statusText perdu pendant la preparation."
}

$propertyInsertPosition =
    $statusIndexAfter +
    $statusAnchor.Length

$properties =
    $newLine +
    $indent +
    "  summary: completionRequestSummary," +
    $newLine +
    $indent +
    "  confirmationText: completionConfirmationText,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $properties +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_COMPLETENESS_12_49",
    "KLYX_READINESS_12_50",
    "KLYX_GUIDED_COMPLETION_12_51",
    "KLYX_PROGRESS_FEEDBACK_12_52",
    "KLYX_REQUEST_SUMMARY_12_53",
    "const completionRequestSummary = isRequestComplete",
    "const completionConfirmationText = isRequestComplete",
    "summary: completionRequestSummary,",
    "confirmationText: completionConfirmationText,"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-53-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.53."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.53 Brain Request Summary ajoute."
Write-Host "OK - resume service / ville / date / heure disponible."
Write-Host "OK - resume genere uniquement si la demande est complete."
Write-Host "OK - confirmation utilisateur preservee."
Write-Host "OK - aucune publication automatique ajoutee."
Write-Host "OK - aucune reservation automatique ajoutee."
Write-Host "OK - aucun paiement automatique ajoute."
Write-Host ""