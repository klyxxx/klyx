$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.57 - Brain Confirmation Policy"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_CONFIRMATION_CHOICES_12_56"
$marker = "KLYX_CONFIRMATION_POLICY_12_57"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.56 introuvable. 12.57 ne sera pas applique."
}

if (-not $content.Contains("const automaticExecutionAllowed = false;")) {
    throw "Protection automaticExecutionAllowed introuvable."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.57 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$optionsAnchor = "confirmationOptions: completionConfirmationOptions,"

$optionsIndex = $content.IndexOf(
    $optionsAnchor,
    $requestIndex
)

if ($optionsIndex -lt 0) {
    throw "confirmationOptions 12.56 introuvable. Aucun fichier modifie."
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
    "$indent// KLYX_CONFIRMATION_POLICY_12_57"
    ($indent + 'const confirmationProtectedActions = [')
    ($indent + '  "market_publish",')
    ($indent + '  "booking_create",')
    ($indent + '  "payment_create",')
    ($indent + '] as const;')
    ""
    ($indent + 'const confirmationSafeActions = [')
    ($indent + '  "edit_request",')
    ($indent + '] as const;')
    ""
    ($indent + 'const completionConfirmationPolicy = {')
    ($indent + '  required: requiresUserConfirmation,')
    ($indent + '  protectedActions: confirmationProtectedActions,')
    ($indent + '  safeActions: confirmationSafeActions,')
    ($indent + '  automaticExecutionAllowed,')
    ($indent + '} as const;')
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

$optionsIndexAfter = $newContent.IndexOf(
    $optionsAnchor,
    $requestIndexAfter
)

if ($optionsIndexAfter -lt 0) {
    throw "confirmationOptions perdu pendant la preparation."
}

$propertyInsertPosition =
    $optionsIndexAfter +
    $optionsAnchor.Length

$newProperty =
    $newLine +
    $indent +
    "  confirmationPolicy: completionConfirmationPolicy,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $newProperty +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_CONFIRMATION_GATE_12_54",
    "KLYX_CONFIRMATION_PROMPT_12_55",
    "KLYX_CONFIRMATION_CHOICES_12_56",
    "KLYX_CONFIRMATION_POLICY_12_57",
    "const confirmationProtectedActions = [",
    '"market_publish",',
    '"booking_create",',
    '"payment_create",',
    "const confirmationSafeActions = [",
    '"edit_request",',
    "const completionConfirmationPolicy = {",
    "required: requiresUserConfirmation,",
    "protectedActions: confirmationProtectedActions,",
    "safeActions: confirmationSafeActions,",
    "automaticExecutionAllowed,",
    "confirmationPolicy: completionConfirmationPolicy,",
    "const automaticExecutionAllowed = false;"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-57-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.57."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.57 Brain Confirmation Policy ajoute."
Write-Host "OK - publication protegee."
Write-Host "OK - reservation protegee."
Write-Host "OK - paiement protege."
Write-Host "OK - modification de demande reste non transactionnelle."
Write-Host "OK - execution automatique toujours interdite."
Write-Host ""