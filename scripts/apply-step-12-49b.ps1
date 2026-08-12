$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.49b - Brain Completeness"
Write-Host "Target: $targetPath"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Fichier introuvable : $targetPath"
}

$content = [System.IO.File]::ReadAllText($targetPath)

$marker = "KLYX_COMPLETENESS_12_49"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.49 est deja present. Aucune duplication."
    exit 0
}

function Find-MatchingParenthesis {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$OpenIndex
    )

    $depth = 0
    $quote = [char]0
    $escaped = $false

    for ($i = $OpenIndex; $i -lt $Text.Length; $i++) {
        $char = $Text[$i]

        if ($quote -ne [char]0) {
            if ($escaped) {
                $escaped = $false
                continue
            }

            if ($char -eq "\") {
                $escaped = $true
                continue
            }

            if ($char -eq $quote) {
                $quote = [char]0
            }

            continue
        }

        if (
            $char -eq "'" -or
            $char -eq '"' -or
            $char -eq '`'
        ) {
            $quote = $char
            continue
        }

        if ($char -eq "(") {
            $depth++
            continue
        }

        if ($char -eq ")") {
            $depth--

            if ($depth -eq 0) {
                return $i
            }
        }
    }

    return -1
}

$signatureIndex = $content.IndexOf("function buildReply")
$declarationType = "function"

if ($signatureIndex -lt 0) {
    $signatureIndex = $content.IndexOf("const buildReply")
    $declarationType = "arrow"
}

if ($signatureIndex -lt 0) {
    $signatureIndex = $content.IndexOf("let buildReply")
    $declarationType = "arrow"
}

if ($signatureIndex -lt 0) {
    throw "buildReply introuvable. Aucun fichier modifie."
}

$openParenIndex = $content.IndexOf("(", $signatureIndex)

if ($openParenIndex -lt 0) {
    throw "Parenthese ouvrante de buildReply introuvable. Aucun fichier modifie."
}

$closeParenIndex = Find-MatchingParenthesis `
    -Text $content `
    -OpenIndex $openParenIndex

if ($closeParenIndex -lt 0) {
    throw "Impossible de trouver la fin des parametres de buildReply. Aucun fichier modifie."
}

$bodyOpenIndex = -1

if ($declarationType -eq "arrow") {
    $arrowIndex = $content.IndexOf("=>", $closeParenIndex)

    if ($arrowIndex -lt 0) {
        throw "Operateur => de buildReply introuvable. Aucun fichier modifie."
    }

    $bodyOpenIndex = $content.IndexOf("{", $arrowIndex)
}
else {
    $bodyOpenIndex = $content.IndexOf("{", $closeParenIndex)
}

if ($bodyOpenIndex -lt 0) {
    throw "Corps de buildReply introuvable. Aucun fichier modifie."
}

$newLine = "`n"

if ($content.Contains("`r`n")) {
    $newLine = "`r`n"
}

$lineStart = $content.LastIndexOf("`n", $signatureIndex)

if ($lineStart -lt 0) {
    $lineStart = 0
}
else {
    $lineStart++
}

$signaturePrefix = $content.Substring(
    $lineStart,
    $signatureIndex - $lineStart
)

$baseIndent = ""

foreach ($char in $signaturePrefix.ToCharArray()) {
    if ($char -eq " " -or $char -eq "`t") {
        $baseIndent += $char
    }
    else {
        break
    }
}

$indent = $baseIndent + "  "

$lines = @(
    "$indent// KLYX_COMPLETENESS_12_49"
    "$indent" + 'const completionParts: string[] = [];'
    ""
    "$indent" + 'if (context.serviceSlug) completionParts.push("service");'
    "$indent" + 'if (context.city) completionParts.push("ville");'
    "$indent" + 'if (context.date) completionParts.push("date");'
    "$indent" + 'if (context.time) completionParts.push("heure");'
    ""
    "$indent" + 'const completionScore = Math.round('
    "$indent  " + '(completionParts.length / 4) * 100'
    "$indent" + ');'
    ""
    "$indent" + 'const completionLabel ='
    "$indent  " + 'completionScore === 100'
    "$indent    " + '? "Demande complète"'
    "$indent    " + ': completionScore >= 75'
    "$indent      " + '? "Presque prête"'
    "$indent      " + ': completionScore >= 50'
    "$indent        " + '? "Demande en cours"'
    "$indent        " + ': "Je précise ton besoin";'
)

$block = [string]::Join($newLine, $lines)

$insertPosition = $bodyOpenIndex + 1

$newContent =
    $content.Substring(0, $insertPosition) +
    $newLine +
    $block +
    $content.Substring($insertPosition)

if (-not $newContent.Contains($marker)) {
    throw "Verification interne echouee avant ecriture."
}

if (-not $newContent.Contains("const completionScore = Math.round(")) {
    throw "completionScore absent avant ecriture."
}

if (-not $newContent.Contains('if (context.serviceSlug) completionParts.push("service");')) {
    throw "Detection du service absente avant ecriture."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-49b-$timestamp"

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

    if (-not $verification.Contains($marker)) {
        throw "Le marqueur est absent apres ecriture."
    }

    if (-not $verification.Contains("const completionScore = Math.round(")) {
        throw "completionScore est absent apres ecriture."
    }

    if (-not $verification.Contains("const completionLabel =")) {
        throw "completionLabel est absent apres ecriture."
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant la modification."
    Write-Host "Restauration automatique de la sauvegarde..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX_COMPLETENESS_12_49 ajoute dans buildReply."
Write-Host "OK - Brain 12.47 et 12.48 conserves."
Write-Host "OK - Aucun flux publication/reservation/paiement modifie."
Write-Host ""