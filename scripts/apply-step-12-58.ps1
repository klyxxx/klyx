$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.58 - Brain Action Eligibility"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_CONFIRMATION_POLICY_12_57"
$marker = "KLYX_ACTION_ELIGIBILITY_12_58"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.57 introuvable. 12.58 ne sera pas applique."
}

if (-not $content.Contains("const automaticExecutionAllowed = false;")) {
    throw "Protection automaticExecutionAllowed introuvable."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.58 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"

$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$policyAnchor = "confirmationPolicy: completionConfirmationPolicy,"

$policyIndex = $content.IndexOf(
    $policyAnchor,
    $requestIndex
)

if ($policyIndex -lt 0) {
    throw "confirmationPolicy 12.57 introuvable. Aucun fichier modifie."
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
    "$indent// KLYX_ACTION_ELIGIBILITY_12_58"
    ($indent + 'const completionActionEligibility = {')
    ($indent + '  editRequest: true,')
    ($indent + '  marketPublish: false,')
    ($indent + '  bookingCreate: false,')
    ($indent + '  paymentCreate: false,')
    ($indent + '  blockedReason: isRequestComplete')
    ($indent + '    ? "awaiting_user_confirmation"')
    ($indent + '    : "request_incomplete",')
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

$policyIndexAfter = $newContent.IndexOf(
    $policyAnchor,
    $requestIndexAfter
)

if ($policyIndexAfter -lt 0) {
    throw "confirmationPolicy perdu pendant la preparation."
}

$propertyInsertPosition =
    $policyIndexAfter +
    $policyAnchor.Length

$newProperty =
    $newLine +
    $indent +
    "  actionEligibility: completionActionEligibility,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $newProperty +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_CONFIRMATION_CHOICES_12_56",
    "KLYX_CONFIRMATION_POLICY_12_57",
    "KLYX_ACTION_ELIGIBILITY_12_58",
    "const completionActionEligibility = {",
    "editRequest: true,",
    "marketPublish: false,",
    "bookingCreate: false,",
    "paymentCreate: false,",
    "blockedReason: isRequestComplete",
    '"awaiting_user_confirmation"',
    '"request_incomplete"',
    "actionEligibility: completionActionEligibility,",
    "const automaticExecutionAllowed = false;"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-58-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.58."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.58 Brain Action Eligibility ajoute."
Write-Host "OK - modification de demande autorisee."
Write-Host "OK - publication marche bloquee."
Write-Host "OK - reservation bloquee."
Write-Host "OK - paiement bloque."
Write-Host "OK - confirmation explicite toujours requise."
Write-Host ""