$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.59 - Brain Post-Confirmation Transition"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$requiredMarker = "KLYX_ACTION_ELIGIBILITY_12_58"
$marker = "KLYX_POST_CONFIRMATION_12_59"

if (-not $content.Contains($requiredMarker)) {
    throw "KLYX 12.58 introuvable. 12.59 ne sera pas applique."
}

if (-not $content.Contains("const automaticExecutionAllowed = false;")) {
    throw "Protection automaticExecutionAllowed introuvable."
}

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.59 est deja present. Aucune duplication."
    exit 0
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$eligibilityAnchor = "actionEligibility: completionActionEligibility,"

$eligibilityIndex = $content.IndexOf(
    $eligibilityAnchor,
    $requestIndex
)

if ($eligibilityIndex -lt 0) {
    throw "actionEligibility 12.58 introuvable. Aucun fichier modifie."
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
    "$indent// KLYX_POST_CONFIRMATION_12_59"
    ($indent + 'const completionPostConfirmation = isRequestComplete')
    ($indent + '  ? {')
    ($indent + '      nextState: "ready_for_market_publish",')
    ($indent + '      unlocks: ["market_publish"],')
    ($indent + '      remainsProtected: [')
    ($indent + '        "booking_create",')
    ($indent + '        "payment_create",')
    ($indent + '      ],')
    ($indent + '      requiresExplicitConfirmation: true,')
    ($indent + '      automaticExecutionAllowed: false,')
    ($indent + '    }')
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

$eligibilityIndexAfter = $newContent.IndexOf(
    $eligibilityAnchor,
    $requestIndexAfter
)

if ($eligibilityIndexAfter -lt 0) {
    throw "actionEligibility perdu pendant la preparation."
}

$propertyInsertPosition =
    $eligibilityIndexAfter +
    $eligibilityAnchor.Length

$newProperty =
    $newLine +
    $indent +
    "  postConfirmation: completionPostConfirmation,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $newProperty +
    $newContent.Substring($propertyInsertPosition)

$requiredChecks = @(
    "KLYX_CONFIRMATION_POLICY_12_57",
    "KLYX_ACTION_ELIGIBILITY_12_58",
    "KLYX_POST_CONFIRMATION_12_59",
    "const completionPostConfirmation = isRequestComplete",
    'nextState: "ready_for_market_publish",',
    'unlocks: ["market_publish"],',
    '"booking_create",',
    '"payment_create",',
    "requiresExplicitConfirmation: true,",
    "automaticExecutionAllowed: false,",
    "postConfirmation: completionPostConfirmation,",
    "const automaticExecutionAllowed = false;"
)

foreach ($check in $requiredChecks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-59-$timestamp"

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
    Write-Host "Erreur pendant KLYX 12.59."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.59 Post-Confirmation Transition ajoute."
Write-Host "OK - market_publish devient la prochaine action possible apres confirmation."
Write-Host "OK - booking_create reste protege."
Write-Host "OK - payment_create reste protege."
Write-Host "OK - aucune execution automatique ajoutee."
Write-Host ""