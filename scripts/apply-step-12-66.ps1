$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$gateRoute = Join-Path `
    $projectRoot `
    "app\api\brain\market-publish\route.ts"

$gateHelper = Join-Path `
    $projectRoot `
    "lib\brain-market-confirmation.ts"

Write-Host ""
Write-Host "KLYX 12.66 - Publish Proof Wiring"
Write-Host ""

if (-not (Test-Path -LiteralPath $gateRoute)) {
    throw "market-publish route introuvable."
}

if (-not (Test-Path -LiteralPath $gateHelper)) {
    throw "Helper 12.65 introuvable."
}

$gateRouteContent =
    [System.IO.File]::ReadAllText($gateRoute)

$gateHelperContent =
    [System.IO.File]::ReadAllText($gateHelper)

if (-not $gateRouteContent.Contains(
    "KLYX_MARKET_CONFIRMATION_GATE_12_65"
)) {
    throw "Prerequis KLYX 12.65 route absent."
}

if (-not $gateHelperContent.Contains(
    "KLYX_MARKET_CONFIRMATION_HELPER_12_65"
)) {
    throw "Prerequis KLYX 12.65 helper absent."
}

$marker =
    "KLYX_PUBLISH_PROOF_WIRING_12_66"

function Get-LineIndent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$Position
    )

    $lineStart =
        $Text.LastIndexOf(
            "`n",
            $Position
        )

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
        if (
            $char -eq " " -or
            $char -eq "`t"
        ) {
            $indent += $char
        }
        else {
            break
        }
    }

    return $indent
}

function Find-JsonObjectAfterMarketPublish {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [int]$EndpointIndex
    )

    $jsonIndex =
        $Text.IndexOf(
            "JSON.stringify(",
            $EndpointIndex,
            [System.StringComparison]::Ordinal
        )

    if ($jsonIndex -lt 0) {
        return -1
    }

    # Ne pas attraper un JSON.stringify tres eloigne
    # appartenant a une autre logique.
    if (($jsonIndex - $EndpointIndex) -gt 6000) {
        return -1
    }

    $position =
        $jsonIndex +
        "JSON.stringify(".Length

    while (
        $position -lt $Text.Length -and
        [char]::IsWhiteSpace(
            $Text[$position]
        )
    ) {
        $position++
    }

    if (
        $position -ge $Text.Length -or
        $Text[$position] -ne "{"
    ) {
        return -1
    }

    return $position
}

$searchRoots = @(
    (Join-Path $projectRoot "app"),
    (Join-Path $projectRoot "components"),
    (Join-Path $projectRoot "lib")
)

$files = @()

foreach ($root in $searchRoots) {
    if (-not (Test-Path -LiteralPath $root)) {
        continue
    }

    $files += Get-ChildItem `
        -LiteralPath $root `
        -Recurse `
        -File `
        -ErrorAction SilentlyContinue |
        Where-Object {
            (
                $_.Extension -eq ".ts" -or
                $_.Extension -eq ".tsx"
            ) -and
            -not $_.Name.Contains(".bak-")
        }
}

$routeFullPath =
    [System.IO.Path]::GetFullPath($gateRoute)

$callers = @()

foreach ($file in $files) {
    $fullPath =
        [System.IO.Path]::GetFullPath(
            $file.FullName
        )

    if ($fullPath -eq $routeFullPath) {
        continue
    }

    $text =
        [System.IO.File]::ReadAllText(
            $file.FullName
        )

    if ($text.Contains(
        "/api/brain/market-publish"
    )) {
        $callers += $file.FullName
    }
}

$callers = @(
    $callers |
    Sort-Object -Unique
)

if ($callers.Count -eq 0) {
    Write-Host ""
    Write-Host "Aucun appel client market-publish trouve."
    Write-Host ""
    Write-Host "Recherche secondaire de 'market-publish'..."

    $secondary = @()

    foreach ($file in $files) {
        $fullPath =
            [System.IO.Path]::GetFullPath(
                $file.FullName
            )

        if ($fullPath -eq $routeFullPath) {
            continue
        }

        $text =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )

        if ($text.Contains("market-publish")) {
            $secondary += $file.FullName
        }
    }

    foreach ($file in ($secondary | Sort-Object -Unique)) {
        Write-Host " - $file"
    }

    throw "Aucun vrai appel /api/brain/market-publish detecte. Aucun fichier modifie."
}

Write-Host "Appel(s) market-publish detecte(s) :"

foreach ($caller in $callers) {
    Write-Host " - $caller"
}

$changes = @()
$backups = @()

try {
    foreach ($callerPath in $callers) {
        $content =
            [System.IO.File]::ReadAllText(
                $callerPath
            )

        if ($content.Contains($marker)) {
            Write-Host ""
            Write-Host "Deja cable : $callerPath"
            continue
        }

        $newLine = if (
            $content.Contains("`r`n")
        ) {
            "`r`n"
        }
        else {
            "`n"
        }

        $newContent = $content
        $searchPosition = 0
        $patchedCount = 0

        while ($true) {
            $endpointIndex =
                $newContent.IndexOf(
                    "/api/brain/market-publish",
                    $searchPosition,
                    [System.StringComparison]::Ordinal
                )

            if ($endpointIndex -lt 0) {
                break
            }

            $objectOpen =
                Find-JsonObjectAfterMarketPublish `
                    -Text $newContent `
                    -EndpointIndex $endpointIndex

            if ($objectOpen -lt 0) {
                throw "JSON.stringify({ ... }) associe a market-publish introuvable dans $callerPath"
            }

            $previewLength =
                [Math]::Min(
                    2500,
                    $newContent.Length -
                    $objectOpen
                )

            $objectPreview =
                $newContent.Substring(
                    $objectOpen,
                    $previewLength
                )

            $hasConversation =
                $objectPreview.Contains(
                    "conversationId"
                )

            $hasConfirmation =
                $objectPreview.Contains(
                    "confirmationId"
                )

            $baseIndent =
                Get-LineIndent `
                    -Text $newContent `
                    -Position $objectOpen

            $propertyIndent =
                $baseIndent + "  "

            $valueIndent =
                $propertyIndent + "  "

            $proofLines = @(
                ""
                ($propertyIndent + "// KLYX_PUBLISH_PROOF_WIRING_12_66")
            )

            if (-not $hasConversation) {
                $proofLines += @(
                    ($propertyIndent + "conversationId:")
                    ($valueIndent + 'typeof window !== "undefined"')
                    ($valueIndent + "  ? new URLSearchParams(")
                    ($valueIndent + "      window.location.search")
                    ($valueIndent + '    ).get("conversationId")')
                    ($valueIndent + "  : null,")
                )
            }

            if (-not $hasConfirmation) {
                $proofLines += @(
                    ($propertyIndent + "confirmationId:")
                    ($valueIndent + 'typeof window !== "undefined"')
                    ($valueIndent + "  ? new URLSearchParams(")
                    ($valueIndent + "      window.location.search")
                    ($valueIndent + '    ).get("confirmationId")')
                    ($valueIndent + "  : null,")
                )
            }

            $proofLines += ""

            $proofBlock =
                [string]::Join(
                    $newLine,
                    $proofLines
                )

            $insertPosition =
                $objectOpen + 1

            $newContent =
                $newContent.Substring(
                    0,
                    $insertPosition
                ) +
                $proofBlock +
                $newContent.Substring(
                    $insertPosition
                )

            $patchedCount++

            $searchPosition =
                $insertPosition +
                $proofBlock.Length +
                1
        }

        if ($patchedCount -lt 1) {
            throw "Aucun appel market-publish cable dans $callerPath"
        }

        if (-not $newContent.Contains($marker)) {
            throw "Marqueur 12.66 absent apres patch : $callerPath"
        }

        if (-not $newContent.Contains(
            'get("conversationId")'
        )) {
            throw "conversationId non cable : $callerPath"
        }

        if (-not $newContent.Contains(
            'get("confirmationId")'
        )) {
            throw "confirmationId non cable : $callerPath"
        }

        $timestamp =
            Get-Date -Format "yyyyMMdd-HHmmss"

        $backup =
            "$callerPath.bak-12-66-$timestamp"

        Copy-Item `
            -LiteralPath $callerPath `
            -Destination $backup `
            -Force

        $backups += @{
            Target = $callerPath
            Backup = $backup
        }

        $utf8NoBom =
            New-Object System.Text.UTF8Encoding(
                $false
            )

        [System.IO.File]::WriteAllText(
            $callerPath,
            $newContent,
            $utf8NoBom
        )

        $changes += $callerPath

        Write-Host ""
        Write-Host "Cable : $callerPath"
        Write-Host "Appels modifies : $patchedCount"
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.66."
    Write-Host "Restauration automatique..."

    foreach ($item in $backups) {
        if (
            Test-Path `
                -LiteralPath $item.Backup
        ) {
            Copy-Item `
                -LiteralPath $item.Backup `
                -Destination $item.Target `
                -Force
        }
    }

    throw
}

if ($changes.Count -eq 0) {
    Write-Host ""
    Write-Host "Tous les appels etaient deja cables."
}
else {
    Write-Host ""
    Write-Host "OK - KLYX 12.66 applique."
    Write-Host "OK - conversationId transmis a market-publish."
    Write-Host "OK - confirmationId transmis a market-publish."
    Write-Host "OK - le verrou serveur 12.65 peut etre franchi legitimement."
    Write-Host "OK - aucun contournement de confirmation ajoute."
}

Write-Host ""