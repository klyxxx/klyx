$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.54 - Brain Confirmation Gate"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_REQUEST_SUMMARY_12_53"
$marker = "KLYX_CONFIRMATION_GATE_12_54"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.53 introuvable. 12.54 ne sera pas applique."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.54 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$confirmationAnchor = "confirmationText: completionConfirmationText,"
$confirmationIndex = $content.IndexOf(
    $confirmationAnchor,
    $requestIndex
)

if ($confirmationIndex -lt 0) {
    throw "confirmationText de KLYX 12.53 introuvable. Aucun fichier modifie."
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
    "$indent// KLYX_CONFIRMATION_GATE_12_54"
    ($indent + 'const requiresUserConfirmation = isRequestComplete;')
    ""
    ($indent + 'const completionNextStep = isRequestComplete')
    ($indent + '  ? "confirm_request"')
    ($indent + '  : "collect_missing_information";')
    ""
    ($indent + 'const automaticExecutionAllowed = false;')
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

$confirmationIndexAfter = $newContent.IndexOf(
    $confirmationAnchor,
    $requestIndexAfter
)

if ($confirmationIndexAfter -lt 0) {
    throw "confirmationText perdu pendant la preparation."
}

$propertyInsertPosition =
    $confirmationIndexAfter +
    $confirmationAnchor.Length

$properties =
    $newLine +
    $indent +
    "  requiresConfirmation: requiresUserConfirmation," +
    $newLine +
    $indent +
    "  nextStep: completionNextStep," +
    $newLine +
    $indent +
    "  automaticExecutionAllowed,"

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
    "KLYX_CONFIRMATION_GATE_12_54",
    "const requiresUserConfirmation = isRequestComplete;",
    "const completionNextStep = isRequestComplete",
    '"confirm_request"',
    '"collect_missing_information"',
    "const automaticExecutionAllowed = false;",
    "requiresConfirmation: requiresUserConfirmation,",
    "nextStep: completionNextStep,",
    "automaticExecutionAllowed,"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-54-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.54."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.54 Brain Confirmation Gate ajoute."
Write-Host "OK - demande complete -> confirmation requise."
Write-Host "OK - demande incomplete -> collecte continue."
Write-Host "OK - execution automatique interdite."
Write-Host "OK - publication protegee."
Write-Host "OK - reservation protegee."
Write-Host "OK - paiement protege."
Write-Host ""