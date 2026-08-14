$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$globalsPath = Join-Path $projectRoot "app\globals.css"

Write-Host ""
Write-Host "KLYX 12.67d - Sidebar Fixed Repair"
Write-Host ""

if (-not (Test-Path -LiteralPath $globalsPath)) {
    throw "app/globals.css introuvable."
}

$content = [System.IO.File]::ReadAllText(
    $globalsPath
)

$oldMarker = "KLYX_FIXED_SIDEBAR_12_67C"
$newMarker = "KLYX_FIXED_SIDEBAR_REPAIR_12_67D"

if (-not $content.Contains($oldMarker)) {
    throw "CSS sidebar 12.67c introuvable."
}

if ($content.Contains($newMarker)) {
    Write-Host "KLYX 12.67d deja applique."
    exit 0
}

$oldBlockLines = @(
    "/* KLYX_FIXED_SIDEBAR_12_67C */"
    "@media (min-width: 1024px) {"
    '  [data-klyx-fixed-sidebar="true"] {'
    "    position: fixed !important;"
    "    top: 0 !important;"
    "    bottom: 0 !important;"
    "    left: 0 !important;"
    "    width: 312px !important;"
    "    height: 100dvh !important;"
    "    max-height: 100dvh !important;"
    "    z-index: 60 !important;"
    "    overflow-y: auto !important;"
    "    overflow-x: hidden !important;"
    "    overscroll-behavior: contain !important;"
    "  }"
    ""
    '  :where(div, section, main):has(> [data-klyx-fixed-sidebar="true"]) {'
    "    padding-left: 312px !important;"
    "  }"
    "}"
)

$oldBlock = [string]::Join(
    "`n",
    $oldBlockLines
)

$oldBlockCrLf = $oldBlock.Replace(
    "`n",
    "`r`n"
)

$newBlockLines = @(
    "/* KLYX_FIXED_SIDEBAR_REPAIR_12_67D */"
    "@media (min-width: 1024px) {"
    '  [data-klyx-fixed-sidebar="true"] {'
    "    position: fixed !important;"
    "    inset: 0 auto 0 0 !important;"
    "    width: 312px !important;"
    "    height: 100dvh !important;"
    "    max-height: 100dvh !important;"
    "    z-index: 60 !important;"
    ""
    "    /*"
    "     * IMPORTANT:"
    "     * le conteneur principal ne doit jamais devenir"
    "     * un deuxieme scroll container."
    "     * La navigation interne KLYX gere deja son scroll."
    "     */"
    "    overflow: hidden !important;"
    "    overscroll-behavior: none !important;"
    "    transform: translateZ(0);"
    "  }"
    ""
    '  :where(div, section, main):has(> [data-klyx-fixed-sidebar="true"]) {'
    "    padding-left: 312px !important;"
    "  }"
    "}"
)

$newBlock = [string]::Join(
    "`n",
    $newBlockLines
)

if ($content.Contains($oldBlock)) {
    $newContent = $content.Replace(
        $oldBlock,
        $newBlock
    )
}
elseif ($content.Contains($oldBlockCrLf)) {
    $newContent = $content.Replace(
        $oldBlockCrLf,
        $newBlock.Replace("`n", "`r`n")
    )
}
else {
    # Reparation structurelle si l'espacement CSS differe.

    $markerIndex = $content.IndexOf(
        "/* KLYX_FIXED_SIDEBAR_12_67C */"
    )

    if ($markerIndex -lt 0) {
        throw "Debut CSS 12.67c introuvable."
    }

    $mediaIndex = $content.IndexOf(
        "@media",
        $markerIndex
    )

    if ($mediaIndex -lt 0) {
        throw "@media sidebar introuvable."
    }

    $openIndex = $content.IndexOf(
        "{",
        $mediaIndex
    )

    if ($openIndex -lt 0) {
        throw "Ouverture @media introuvable."
    }

    $depth = 0
    $closeIndex = -1

    for (
        $i = $openIndex;
        $i -lt $content.Length;
        $i++
    ) {
        if ($content[$i] -eq "{") {
            $depth++
        }
        elseif ($content[$i] -eq "}") {
            $depth--

            if ($depth -eq 0) {
                $closeIndex = $i
                break
            }
        }
    }

    if ($closeIndex -lt 0) {
        throw "Fin CSS sidebar introuvable."
    }

    $newContent =
        $content.Substring(
            0,
            $markerIndex
        ) +
        $newBlock +
        $content.Substring(
            $closeIndex + 1
        )
}

if (-not $newContent.Contains($newMarker)) {
    throw "Marqueur 12.67d absent."
}

if ($newContent.Contains(
    "overflow-y: auto !important;"
)) {
    throw "Ancien scroll externe sidebar encore present."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$backup =
    "$globalsPath.bak-12-67d-$timestamp"

Copy-Item `
    -LiteralPath $globalsPath `
    -Destination $backup `
    -Force

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $globalsPath,
        $newContent,
        $utf8NoBom
    )
}
catch {
    Copy-Item `
        -LiteralPath $backup `
        -Destination $globalsPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.67d applique."
Write-Host "OK - sidebar reste fixe."
Write-Host "OK - scroll externe sidebar supprime."
Write-Host "OK - menus ne doivent plus passer sous le logo."
Write-Host ""