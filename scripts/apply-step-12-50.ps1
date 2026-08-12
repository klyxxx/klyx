$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.50 - Brain Readiness"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$marker1249 = "KLYX_COMPLETENESS_12_49"
$marker1250 = "KLYX_READINESS_12_50"

if (-not $content.Contains($marker1249)) {
    throw "KLYX 12.49 est introuvable. 12.50 ne sera pas applique."
}

if ($content.Contains($marker1250)) {
    Write-Host "KLYX 12.50 est deja present. Aucune duplication."
    exit 0
}

$labelStart = $content.IndexOf("const completionLabel =")

if ($labelStart -lt 0) {
    throw "completionLabel introuvable. Aucun fichier modifie."
}

$labelEnd = $content.IndexOf(";", $labelStart)

if ($labelEnd -lt 0) {
    throw "Fin de completionLabel introuvable. Aucun fichier modifie."
}

$insertPosition = $labelEnd + 1

$newLine = "`n"

if ($content.Contains("`r`n")) {
    $newLine = "`r`n"
}

$lineStart = $content.LastIndexOf("`n", $labelStart)

if ($lineStart -lt 0) {
    $lineStart = 0
}
else {
    $lineStart++
}

$prefix = $content.Substring(
    $lineStart,
    $labelStart - $lineStart
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
    ""
    "$indent// KLYX_READINESS_12_50"
    "$indent" + 'const missingCompletionParts: string[] = [];'
    ""
    "$indent" + 'if (!context.serviceSlug) missingCompletionParts.push("service");'
    "$indent" + 'if (!context.city) missingCompletionParts.push("ville");'
    "$indent" + 'if (!context.date) missingCompletionParts.push("date");'
    "$indent" + 'if (!context.time) missingCompletionParts.push("heure");'
    ""
    "$indent" + 'const isRequestComplete = completionScore === 100;'
    "$indent" + 'const nextMissingPart = missingCompletionParts[0] ?? null;'
    ""
    "$indent" + 'const requestReadiness = {'
    "$indent  " + 'score: completionScore,'
    "$indent  " + 'label: completionLabel,'
    "$indent  " + 'isComplete: isRequestComplete,'
    "$indent  " + 'missing: missingCompletionParts,'
    "$indent  " + 'nextMissing: nextMissingPart,'
    "$indent" + '};'
    ""
    "$indent" + 'void requestReadiness;'
)

$block = [string]::Join($newLine, $lines)

$newContent =
    $content.Substring(0, $insertPosition) +
    $block +
    $content.Substring($insertPosition)

if (-not $newContent.Contains($marker1250)) {
    throw "Verification interne 12.50 echouee."
}

if (-not $newContent.Contains("const isRequestComplete = completionScore === 100;")) {
    throw "isRequestComplete absent avant ecriture."
}

if (-not $newContent.Contains("const nextMissingPart = missingCompletionParts[0] ?? null;")) {
    throw "nextMissingPart absent avant ecriture."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-50-$timestamp"

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

    if (-not $verification.Contains($marker1249)) {
        throw "Le marqueur 12.49 a disparu."
    }

    if (-not $verification.Contains($marker1250)) {
        throw "Le marqueur 12.50 est absent apres ecriture."
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur. Restauration de la sauvegarde..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.50 Brain Readiness ajoute."
Write-Host "OK - 12.49 conserve."
Write-Host "OK - aucune publication automatique ajoutee."
Write-Host "OK - aucune reservation automatique ajoutee."
Write-Host "OK - aucun paiement automatique ajoute."
Write-Host ""