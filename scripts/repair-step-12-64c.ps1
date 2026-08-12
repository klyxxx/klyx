$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$targetPath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $text = [System.IO.File]::ReadAllText($candidate)

    if ($text.Contains("KLYX_CONFIRMATION_PROOF_12_64")) {
        $targetPath = $candidate
        break
    }
}

Write-Host ""
Write-Host "KLYX 12.64c - Repair openResults handler"
Write-Host ""

if (-not $targetPath) {
    throw "Page assistant KLYX 12.64 introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

if (-not $content.Contains(
    "function openResults(confirmationId?: string)"
)) {
    throw "Signature openResults 12.64 introuvable."
}

$marker = "KLYX_OPEN_RESULTS_HANDLER_REPAIR_12_64C"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.64c deja applique."
    exit 0
}

$newContent = $content

# React onClick fournit un MouseEvent.
# openResults attend maintenant un string optionnel.
# On enveloppe donc les usages directs dans une lambda.

$directHandler = "onClick={openResults}"

$count = 0
$position = 0

while ($true) {
    $index = $newContent.IndexOf(
        $directHandler,
        $position,
        [System.StringComparison]::Ordinal
    )

    if ($index -lt 0) {
        break
    }

    $replacement =
        "onClick={() => openResults()}"

    $newContent =
        $newContent.Substring(0, $index) +
        $replacement +
        $newContent.Substring(
            $index + $directHandler.Length
        )

    $count++
    $position =
        $index + $replacement.Length
}

# Même protection si un onConfirm direct subsiste quelque part.
$directConfirm = "onConfirm={openResults}"

$position = 0

while ($true) {
    $index = $newContent.IndexOf(
        $directConfirm,
        $position,
        [System.StringComparison]::Ordinal
    )

    if ($index -lt 0) {
        break
    }

    $replacement =
        "onConfirm={() => openResults()}"

    $newContent =
        $newContent.Substring(0, $index) +
        $replacement +
        $newContent.Substring(
            $index + $directConfirm.Length
        )

    $count++
    $position =
        $index + $replacement.Length
}

# Ajouter le marqueur avant openResults.
$functionIndex =
    $newContent.IndexOf(
        "function openResults(confirmationId?: string)"
    )

if ($functionIndex -lt 0) {
    throw "openResults perdu pendant la correction."
}

$lineStart =
    $newContent.LastIndexOf(
        "`n",
        $functionIndex
    )

if ($lineStart -lt 0) {
    $lineStart = 0
}
else {
    $lineStart++
}

$newLine = if ($newContent.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

$newContent =
    $newContent.Substring(0, $lineStart) +
    "  // KLYX_OPEN_RESULTS_HANDLER_REPAIR_12_64C" +
    $newLine +
    $newContent.Substring($lineStart)

$checks = @(
    "KLYX_CONFIRMATION_PROOF_12_64",
    "KLYX_OPEN_RESULTS_HANDLER_REPAIR_12_64C",
    "function openResults(confirmationId?: string)",
    "openResults(confirmationId);"
)

foreach ($check in $checks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification echouee : $check"
    }
}

if ($newContent.Contains("onClick={openResults}")) {
    throw "Un onClick direct vers openResults subsiste."
}

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backup =
    "$targetPath.bak-12-64c-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backup `
    -Force

Write-Host "Backup : $backup"
Write-Host "Handlers corriges : $count"

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $targetPath,
        $newContent,
        $utf8NoBom
    )
}
catch {
    Copy-Item `
        -LiteralPath $backup `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.64c applique."
Write-Host "OK - compatibilite React onClick/openResults corrigee."
Write-Host ""