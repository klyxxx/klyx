$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.56 - Brain Confirmation Choices"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_CONFIRMATION_PROMPT_12_55"
$marker = "KLYX_CONFIRMATION_CHOICES_12_56"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.55 introuvable. 12.56 ne sera pas applique."
}

if (-not $content.Contains("const automaticExecutionAllowed = false;")) {
    throw "Protection automaticExecutionAllowed introuvable."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.56 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$confirmationPromptAnchor = "confirmationPrompt: completionConfirmationPrompt,"

$confirmationPromptIndex = $content.IndexOf(
    $confirmationPromptAnchor,
    $requestIndex
)

if ($confirmationPromptIndex -lt 0) {
    throw "confirmationPrompt 12.55 introuvable. Aucun fichier modifie."
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
    "$indent// KLYX_CONFIRMATION_CHOICES_12_56"
    ($indent + 'const completionConfirmationState = isRequestComplete')
    ($indent + '  ? "awaiting_user_confirmation"')
    ($indent + '  : "not_ready";')
    ""
    ($indent + 'const completionConfirmationOptions = isRequestComplete')
    ($indent + '  ? [')
    ($indent + '      {')
    ($indent + '        id: "confirm",')
    ($indent + '        action: "confirm_request",')
    ($indent + '        label: "Confirmer",')
    ($indent + '      },')
    ($indent + '      {')
    ($indent + '        id: "edit",')
    ($indent + '        action: "edit_request",')
    ($indent + '        label: "Modifier",')
    ($indent + '      },')
    ($indent + '    ]')
    ($indent + '  : [];')
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

$confirmationPromptIndexAfter = $newContent.IndexOf(
    $confirmationPromptAnchor,
    $requestIndexAfter
)

if ($confirmationPromptIndexAfter -lt 0) {
    throw "confirmationPrompt perdu pendant la preparation."
}

$propertyInsertPosition =
    $confirmationPromptIndexAfter +
    $confirmationPromptAnchor.Length

$properties =
    $newLine +
    $indent +
    "  confirmationState: completionConfirmationState," +
    $newLine +
    $indent +
    "  confirmationOptions: completionConfirmationOptions,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $properties +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_CONFIRMATION_GATE_12_54",
    "KLYX_CONFIRMATION_PROMPT_12_55",
    "KLYX_CONFIRMATION_CHOICES_12_56",
    "const completionConfirmationState = isRequestComplete",
    '"awaiting_user_confirmation"',
    '"not_ready"',
    "const completionConfirmationOptions = isRequestComplete",
    'action: "confirm_request",',
    'action: "edit_request",',
    'label: "Confirmer",',
    'label: "Modifier",',
    "confirmationState: completionConfirmationState,",
    "confirmationOptions: completionConfirmationOptions,",
    "const automaticExecutionAllowed = false;"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-56-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.56."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.56 Brain Confirmation Choices ajoute."
Write-Host "OK - etat awaiting_user_confirmation disponible."
Write-Host "OK - choix Confirmer / Modifier disponibles."
Write-Host "OK - aucune execution automatique ajoutee."
Write-Host ""