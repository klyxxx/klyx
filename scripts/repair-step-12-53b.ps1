$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "KLYX 12.53b - Repair Brain Request Summary"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

$marker1252 = "KLYX_PROGRESS_FEEDBACK_12_52"
$marker1253 = "KLYX_REQUEST_SUMMARY_12_53"

if (-not $content.Contains($marker1252)) {
    throw "KLYX 12.52 introuvable. Aucun fichier modifie."
}

function Remove-CodeWhitespace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $Text.ToCharArray()) {
        if (-not [char]::IsWhiteSpace($char)) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString()
}

function Test-Structure {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $compact = Remove-CodeWhitespace $Text

    $required = @(
        "KLYX_REQUEST_SUMMARY_12_53",
        "constcompletionRequestSummary=isRequestComplete",
        "service:context.serviceSlug,",
        "city:context.city,",
        "date:context.date,",
        "time:context.time,",
        "constcompletionConfirmationText=isRequestComplete",
        "summary:completionRequestSummary,",
        "confirmationText:completionConfirmationText,"
    )

    foreach ($item in $required) {
        if (-not $compact.Contains($item)) {
            return $false
        }
    }

    return $true
}

if (Test-Structure $content) {
    Write-Host "OK - 12.53 est deja structurellement complete."
    Write-Host "Aucune modification necessaire."
    exit 0
}

if ($content.Contains($marker1253)) {
    Write-Host ""
    Write-Host "Le marqueur 12.53 existe mais la structure est incomplete."
    Write-Host "Aucune correction forcee ne sera effectuee."
    Write-Host ""

    $compact = Remove-CodeWhitespace $content

    $diagnostics = @(
        @{
            Name = "summary variable"
            Token = "constcompletionRequestSummary=isRequestComplete"
        },
        @{
            Name = "service"
            Token = "service:context.serviceSlug,"
        },
        @{
            Name = "city"
            Token = "city:context.city,"
        },
        @{
            Name = "date"
            Token = "date:context.date,"
        },
        @{
            Name = "time"
            Token = "time:context.time,"
        },
        @{
            Name = "confirmation variable"
            Token = "constcompletionConfirmationText=isRequestComplete"
        },
        @{
            Name = "summary property"
            Token = "summary:completionRequestSummary,"
        },
        @{
            Name = "confirmation property"
            Token = "confirmationText:completionConfirmationText,"
        }
    )

    foreach ($check in $diagnostics) {
        if ($compact.Contains($check.Token)) {
            Write-Host "[OK]   $($check.Name)"
        }
        else {
            Write-Host "[MISS] $($check.Name)"
        }
    }

    throw "12.53 existe partiellement. Diagnostic affiche ci-dessus."
}

$requestAnchor = "const requestReadiness = {"
$requestIndex = $content.IndexOf($requestAnchor)

if ($requestIndex -lt 0) {
    throw "requestReadiness introuvable. Aucun fichier modifie."
}

$statusAnchor = "statusText: completionStatusText,"
$statusIndex = $content.IndexOf(
    $statusAnchor,
    $requestIndex
)

if ($statusIndex -lt 0) {
    throw "statusText 12.52 introuvable. Aucun fichier modifie."
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
    "$indent// KLYX_REQUEST_SUMMARY_12_53"
    ($indent + 'const completionRequestSummary = isRequestComplete')
    ($indent + '  ? {')
    ($indent + '      service: context.serviceSlug,')
    ($indent + '      city: context.city,')
    ($indent + '      date: context.date,')
    ($indent + '      time: context.time,')
    ($indent + '    }')
    ($indent + '  : null;')
    ""
    ($indent + 'const completionConfirmationText = isRequestComplete')
    ($indent + '  ? `Service: ${context.serviceSlug} | Ville: ${context.city} | Date: ${context.date} | Heure: ${context.time}`')
    ($indent + '  : null;')
    ""
)

$block = [string]::Join($newLine, $lines)

$newContent =
    $content.Substring(0, $requestIndex) +
    $block +
    $content.Substring($requestIndex)

$requestIndexAfter = $newContent.IndexOf($requestAnchor)

if ($requestIndexAfter -lt 0) {
    throw "requestReadiness perdu avant ecriture."
}

$statusIndexAfter = $newContent.IndexOf(
    $statusAnchor,
    $requestIndexAfter
)

if ($statusIndexAfter -lt 0) {
    throw "statusText perdu avant ecriture."
}

$propertyInsertPosition =
    $statusIndexAfter +
    $statusAnchor.Length

$properties =
    $newLine +
    $indent +
    "  summary: completionRequestSummary," +
    $newLine +
    $indent +
    "  confirmationText: completionConfirmationText,"

$newContent =
    $newContent.Substring(0, $propertyInsertPosition) +
    $properties +
    $newContent.Substring($propertyInsertPosition)

if (-not (Test-Structure $newContent)) {
    throw "Verification structurelle echouee avant ecriture."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-53b-$timestamp"

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

    if (-not (Test-Structure $verification)) {
        throw "Verification structurelle echouee apres ecriture."
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant la modification."
    Write-Host "Restauration automatique..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.53 repare."
Write-Host "OK - Request Summary disponible."
Write-Host "OK - confirmation utilisateur preservee."
Write-Host "OK - aucune action transactionnelle automatique ajoutee."
Write-Host ""