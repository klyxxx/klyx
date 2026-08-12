$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.55 - Brain Confirmation Prompt"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_CONFIRMATION_GATE_12_54"
$marker = "KLYX_CONFIRMATION_PROMPT_12_55"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.54 introuvable. 12.55 ne sera pas applique."
}

if (-not $content.Contains("const automaticExecutionAllowed = false;")) {
    throw "Protection 12.54 introuvable. Aucun fichier modifie."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.55 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$executionProperty = "automaticExecutionAllowed,"

$executionIndex = $content.IndexOf(
    $executionProperty,
    $requestIndex
)

if ($executionIndex -lt 0) {
    throw "automaticExecutionAllowed absent de requestReadiness."
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
    "$indent// KLYX_CONFIRMATION_PROMPT_12_55"
    ($indent + 'const completionConfirmationPrompt = isRequestComplete')
    ($indent + '  ? "Ta demande est complète. Vérifie le résumé puis confirme avant toute publication, réservation ou paiement."')
    ($indent + '  : null;')
    ""
)

$block = [string]::Join(
    $newLine,
    $lines
)

$newContent =
    $content.Substring(0, $requestIndex) +
    $block +
    $content.Substring($requestIndex)

$requestIndexAfter = $newContent.IndexOf(
    $requestAnchor
)

if ($requestIndexAfter -lt 0) {
    throw "requestReadiness perdu pendant la preparation."
}

$executionIndexAfter = $newContent.IndexOf(
    $executionProperty,
    $requestIndexAfter
)

if ($executionIndexAfter -lt 0) {
    throw "automaticExecutionAllowed perdu pendant la preparation."
}

$propertyInsertPosition =
    $executionIndexAfter +
    $executionProperty.Length

$newProperty =
    $newLine +
    $indent +
    "  confirmationPrompt: completionConfirmationPrompt,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $newProperty +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_REQUEST_SUMMARY_12_53",
    "KLYX_CONFIRMATION_GATE_12_54",
    "KLYX_CONFIRMATION_PROMPT_12_55",
    "const completionConfirmationPrompt = isRequestComplete",
    "confirmationPrompt: completionConfirmationPrompt,",
    "const automaticExecutionAllowed = false;",
    '"confirm_request"'
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-55-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.55."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.55 Brain Confirmation Prompt ajoute."
Write-Host "OK - confirmation demandee uniquement si demande complete."
Write-Host "OK - Confirmation Gate 12.54 conserve."
Write-Host "OK - execution automatique toujours interdite."
Write-Host "OK - publication / reservation / paiement proteges."
Write-Host ""