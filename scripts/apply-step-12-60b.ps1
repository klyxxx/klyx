$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.60b - Brain Visible Readiness"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

$marker = "KLYX_VISIBLE_READINESS_12_60"

if ($content.Contains($marker)) {
    Write-Host "KLYX 12.60 est deja present. Aucune duplication."
    exit 0
}

$required = @(
    "KLYX_COMPLETENESS_12_49",
    "KLYX_READINESS_12_50",
    "KLYX_GUIDED_COMPLETION_12_51",
    "KLYX_PROGRESS_FEEDBACK_12_52",
    "KLYX_REQUEST_SUMMARY_12_53",
    "KLYX_CONFIRMATION_GATE_12_54",
    "KLYX_CONFIRMATION_PROMPT_12_55",
    "KLYX_CONFIRMATION_CHOICES_12_56",
    "KLYX_CONFIRMATION_POLICY_12_57",
    "KLYX_ACTION_ELIGIBILITY_12_58",
    "KLYX_POST_CONFIRMATION_12_59"
)

foreach ($item in $required) {
    if (-not $content.Contains($item)) {
        throw "Prerequis absent : $item. Aucun fichier modifie."
    }
}

function Find-MatchingBrace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$OpenIndex
    )

    $depth = 0
    $quote = [char]0
    $escaped = $false
    $lineComment = $false
    $blockComment = $false

    for ($i = $OpenIndex; $i -lt $Text.Length; $i++) {
        $char = $Text[$i]
        $next = if ($i + 1 -lt $Text.Length) {
            $Text[$i + 1]
        }
        else {
            [char]0
        }

        if ($lineComment) {
            if ($char -eq "`n") {
                $lineComment = $false
            }

            continue
        }

        if ($blockComment) {
            if ($char -eq "*" -and $next -eq "/") {
                $blockComment = $false
                $i++
            }

            continue
        }

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

        if ($char -eq "/" -and $next -eq "/") {
            $lineComment = $true
            $i++
            continue
        }

        if ($char -eq "/" -and $next -eq "*") {
            $blockComment = $true
            $i++
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

        if ($char -eq "{") {
            $depth++
            continue
        }

        if ($char -eq "}") {
            $depth--

            if ($depth -eq 0) {
                return $i
            }
        }
    }

    return -1
}

function Get-Indent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$Position
    )

    $lineStart = $Text.LastIndexOf("`n", $Position)

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart++
    }

    $prefix = $Text.Substring(
        $lineStart,
        $Position - $lineStart
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

    return $indent
}

function Find-ReturnStatements {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$Start,

        [Parameter(Mandatory = $true)]
        [int]$End
    )

    $results = @()
    $position = $Start

    while ($position -lt $End) {
        $index = $Text.IndexOf(
            "return ",
            $position,
            [System.StringComparison]::Ordinal
        )

        if ($index -lt 0 -or $index -ge $End) {
            break
        }

        $results += $index
        $position = $index + 7
    }

    return $results
}

$functionIndex = $content.IndexOf("function buildReply(")

if ($functionIndex -lt 0) {
    throw "buildReply introuvable. Aucun fichier modifie."
}

$functionOpen = $content.IndexOf("{", $functionIndex)

if ($functionOpen -lt 0) {
    throw "Ouverture de buildReply introuvable."
}

$functionClose = Find-MatchingBrace `
    -Text $content `
    -OpenIndex $functionOpen

if ($functionClose -lt 0) {
    throw "Fin de buildReply introuvable."
}

$missingIfIndex = $content.IndexOf(
    "if (missing.length > 0)",
    $functionOpen
)

if (
    $missingIfIndex -lt 0 -or
    $missingIfIndex -ge $functionClose
) {
    throw "Bloc missing introuvable dans buildReply."
}

$missingOpen = $content.IndexOf(
    "{",
    $missingIfIndex
)

if ($missingOpen -lt 0) {
    throw "Ouverture du bloc missing introuvable."
}

$missingClose = Find-MatchingBrace `
    -Text $content `
    -OpenIndex $missingOpen

if (
    $missingClose -lt 0 -or
    $missingClose -gt $functionClose
) {
    throw "Fin du bloc missing introuvable."
}

$missingReturns = Find-ReturnStatements `
    -Text $content `
    -Start $missingOpen `
    -End $missingClose

if ($missingReturns.Count -lt 1) {
    throw "Aucun return trouve dans le bloc missing."
}

$missingReturnStart = $missingReturns[-1]

$missingReturnEnd = $content.IndexOf(
    ";",
    $missingReturnStart
)

if (
    $missingReturnEnd -lt 0 -or
    $missingReturnEnd -ge $missingClose
) {
    throw "Fin du return missing introuvable."
}

$missingReturnEnd++

$functionReturns = Find-ReturnStatements `
    -Text $content `
    -Start ($missingClose + 1) `
    -End $functionClose

if ($functionReturns.Count -lt 1) {
    throw "Return final de buildReply introuvable."
}

$completeReturnStart = $functionReturns[-1]

$completeReturnEnd = $content.IndexOf(
    ";",
    $completeReturnStart
)

if (
    $completeReturnEnd -lt 0 -or
    $completeReturnEnd -ge $functionClose
) {
    throw "Fin du return final introuvable."
}

$completeReturnEnd++

if ($completeReturnStart -le $missingReturnStart) {
    throw "Ordre des retours buildReply incoherent."
}

$newLine = if ($content.Contains("`r`n")) {
    "`r`n"
}
else {
    "`n"
}

$missingIndent = Get-Indent `
    -Text $content `
    -Position $missingReturnStart

$completeIndent = Get-Indent `
    -Text $content `
    -Position $completeReturnStart

$missingLines = @(
    ($missingIndent + "// KLYX_VISIBLE_READINESS_12_60")
    ($missingIndent + "const guidedQuestion =")
    ($missingIndent + "  nextCompletionQuestion ??")
    ($missingIndent + "  questions[missing[0]] ??")
    ($missingIndent + '  "Peux-tu préciser ta demande ?";')
    ""
    ($missingIndent + 'return `${completionStatusText}\n\n${guidedQuestion}`;')
)

$missingReplacement = [string]::Join(
    $newLine,
    $missingLines
)

$completeLines = @(
    ($completeIndent + 'return `${completionStatusText}\n\n${')
    ($completeIndent + '  completionConfirmationText ?? "Demande prête."')
    ($completeIndent + '}\n\n${')
    ($completeIndent + '  completionConfirmationPrompt ??')
    ($completeIndent + '  "Vérifie la demande puis confirme avant de continuer."')
    ($completeIndent + '}`;')
)

$completeReplacement = [string]::Join(
    $newLine,
    $completeLines
)

# On remplace du bas vers le haut pour conserver les positions.

$newContent =
    $content.Substring(0, $completeReturnStart) +
    $completeReplacement +
    $content.Substring($completeReturnEnd)

$newContent =
    $newContent.Substring(0, $missingReturnStart) +
    $missingReplacement +
    $newContent.Substring($missingReturnEnd)

$checks = @(
    "KLYX_VISIBLE_READINESS_12_60",
    "const guidedQuestion =",
    "nextCompletionQuestion ??",
    "questions[missing[0]] ??",
    "completionStatusText",
    "completionConfirmationText",
    "completionConfirmationPrompt",
    "const automaticExecutionAllowed = false;"
)

foreach ($check in $checks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-60b-$timestamp"

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

    $verification = [System.IO.File]::ReadAllText(
        $targetPath
    )

    foreach ($check in $checks) {
        if (-not $verification.Contains($check)) {
            throw "Verification apres ecriture echouee : $check"
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant 12.60b."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.60b applique."
Write-Host "OK - progression visible."
Write-Host "OK - question manquante visible."
Write-Host "OK - resume final visible."
Write-Host "OK - confirmation explicite visible."
Write-Host "OK - aucune execution automatique ajoutee."
Write-Host ""