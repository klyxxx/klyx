$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$sidebarPath = Join-Path `
    $projectRoot `
    "app\ui\AppSidebar.tsx"

$settingsPath = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

Write-Host ""
Write-Host "KLYX 12.67e - REAL Sidebar + Phone Placement"
Write-Host ""

foreach ($path in @(
    $sidebarPath,
    $settingsPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

function Find-TagEnd {
    param(
        [string]$Text,
        [int]$StartIndex
    )

    $quote = [char]0
    $escaped = $false

    for (
        $i = $StartIndex;
        $i -lt $Text.Length;
        $i++
    ) {
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
            $char -eq '"' -or
            $char -eq "'"
        ) {
            $quote = $char
            continue
        }

        if ($char -eq ">") {
            return $i
        }
    }

    return -1
}

$newLine = "`n"

# ============================================================
# 1. VRAIE SIDEBAR
# ============================================================

$sidebarContent =
    [System.IO.File]::ReadAllText(
        $sidebarPath
    )

$sidebarMarker =
    "KLYX_REAL_FIXED_SIDEBAR_12_67E"

if (-not $sidebarContent.Contains($sidebarMarker)) {

    $oldMarker =
        "KLYX_FIXED_APP_SIDEBAR_12_67B"

    $markerIndex =
        $sidebarContent.IndexOf(
            $oldMarker
        )

    if ($markerIndex -lt 0) {
        throw "Marqueur sidebar 12.67b introuvable."
    }

    # Trouver exactement le aside desktop contenant le marqueur.
    $asideStart =
        $sidebarContent.LastIndexOf(
            "<aside",
            $markerIndex
        )

    if ($asideStart -lt 0) {
        throw "Aside desktop introuvable."
    }

    $asideTagEnd =
        Find-TagEnd `
            -Text $sidebarContent `
            -StartIndex $asideStart

    if ($asideTagEnd -lt 0) {
        throw "Fin aside desktop introuvable."
    }

    $newAsideTag =
        '<aside className="fixed inset-y-0 left-0 z-50 hidden h-dvh w-[18rem] flex-col overflow-hidden border-r border-border bg-card text-foreground dark:border-white/8 dark:bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] dark:text-white lg:flex">'

    $sidebarContent =
        $sidebarContent.Substring(
            0,
            $asideStart
        ) +
        $newAsideTag +
        $sidebarContent.Substring(
            $asideTagEnd + 1
        )

    # Ajouter notre marqueur.
    $oldMarkerComment =
        "{/* KLYX_FIXED_APP_SIDEBAR_12_67B */}"

    $newMarkerComment =
        $oldMarkerComment +
        $newLine +
        "        {/* KLYX_REAL_FIXED_SIDEBAR_12_67E */}"

    $sidebarContent =
        $sidebarContent.Replace(
            $oldMarkerComment,
            $newMarkerComment
        )

    # Retrouver la fermeture du desktop aside.
    $markerIndex =
        $sidebarContent.IndexOf(
            $sidebarMarker
        )

    $asideClose =
        $sidebarContent.IndexOf(
            "</aside>",
            $markerIndex
        )

    if ($asideClose -lt 0) {
        throw "Fermeture aside desktop introuvable."
    }

    $asideCloseEnd =
        $asideClose +
        "</aside>".Length

    # Comme le aside devient position:fixed,
    # on ajoute un spacer de même largeur pour
    # que le dashboard reste à sa place.
    $spacerLines = @(
        ""
        '      {/* KLYX_DESKTOP_SIDEBAR_SPACER_12_67E */}'
        '      <div'
        '        aria-hidden="true"'
        '        className="hidden w-[18rem] shrink-0 lg:block"'
        '      />'
    )

    $spacer =
        [string]::Join(
            $newLine,
            $spacerLines
        )

    $sidebarContent =
        $sidebarContent.Substring(
            0,
            $asideCloseEnd
        ) +
        $spacer +
        $sidebarContent.Substring(
            $asideCloseEnd
        )
}

# Vérification du nav interne.
if (-not $sidebarContent.Contains(
    'className="klyx-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2"'
)) {
    throw "Navigation scrollable attendue introuvable."
}

# ============================================================
# 2. TELEPHONE : RETIRER L'INJECTION DU LOADING
# ============================================================

$settingsContent =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

# Supprime toutes les anciennes injections 12.67c.
$settingsContent =
    [regex]::Replace(
        $settingsContent,
        '(?m)^\s*\{/\* KLYX_PHONE_VISIBLE_SETTINGS_12_67C \*/\}\s*\r?\n\s*<PhoneSettingsInline\s*/>\s*\r?\n?',
        ""
    )

# Supprime également l'ancien gros lien 12.67b
# qui avait lui aussi été placé dans le mauvais return.
$settingsContent =
    [regex]::Replace(
        $settingsContent,
        '(?s)\s*\{/\* KLYX_PHONE_SETTINGS_ENTRY_12_67B \*/\}\s*<a\b.*?</a>\s*',
        "`n"
    )

$newPhoneMarker =
    "KLYX_PHONE_REAL_SETTINGS_12_67E"

if (-not $settingsContent.Contains($newPhoneMarker)) {

    if (-not $settingsContent.Contains(
        'import PhoneSettingsInline from "./PhoneSettingsInline";'
    )) {
        throw "Import PhoneSettingsInline introuvable."
    }

    # Le DERNIER return de la page correspond au vrai affichage
    # après chargement, contrairement au return du if(loading).
    $returnIndex =
        $settingsContent.LastIndexOf(
            "return ("
        )

    if ($returnIndex -lt 0) {
        throw "Return principal de settings introuvable."
    }

    $possibleRoots = @()

    foreach ($token in @(
        "<>",
        "<main",
        "<div",
        "<section"
    )) {
        $index =
            $settingsContent.IndexOf(
                $token,
                $returnIndex
            )

        if ($index -ge 0) {
            $possibleRoots += @{
                Token = $token
                Index = $index
            }
        }
    }

    if ($possibleRoots.Count -lt 1) {
        throw "Root JSX principal settings introuvable."
    }

    $root =
        $possibleRoots |
        Sort-Object Index |
        Select-Object -First 1

    if ($root.Token -eq "<>") {
        $insertIndex =
            $root.Index + 2
    }
    else {
        $tagEnd =
            Find-TagEnd `
                -Text $settingsContent `
                -StartIndex $root.Index

        if ($tagEnd -lt 0) {
            throw "Fin root settings introuvable."
        }

        $insertIndex =
            $tagEnd + 1
    }

    $phoneLines = @(
        ""
        "      {/* KLYX_PHONE_REAL_SETTINGS_12_67E */}"
        "      <PhoneSettingsInline />"
        ""
    )

    $phoneBlock =
        [string]::Join(
            $newLine,
            $phoneLines
        )

    $settingsContent =
        $settingsContent.Substring(
            0,
            $insertIndex
        ) +
        $phoneBlock +
        $settingsContent.Substring(
            $insertIndex
        )
}

# ============================================================
# 3. VERIFICATIONS AVANT ECRITURE
# ============================================================

$phoneMatches =
    [regex]::Matches(
        $settingsContent,
        '<PhoneSettingsInline\s*/>'
    )

if ($phoneMatches.Count -ne 1) {
    throw "PhoneSettingsInline doit exister exactement une fois. Trouve : $($phoneMatches.Count)"
}

$mainReturn =
    $settingsContent.LastIndexOf(
        "return ("
    )

$phoneIndex =
    $settingsContent.IndexOf(
        "KLYX_PHONE_REAL_SETTINGS_12_67E"
    )

if (
    $phoneIndex -lt 0 -or
    $phoneIndex -lt $mainReturn
) {
    throw "Telephone encore place avant le vrai return principal."
}

if (-not $sidebarContent.Contains(
    "fixed inset-y-0 left-0"
)) {
    throw "Sidebar fixed absente."
}

if (-not $sidebarContent.Contains(
    "KLYX_DESKTOP_SIDEBAR_SPACER_12_67E"
)) {
    throw "Spacer desktop absent."
}

if ($sidebarContent.Contains(
    "shrink-0self-start"
)) {
    throw "Ancienne classe sidebar corrompue encore presente."
}

# ============================================================
# 4. BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$sidebarBackup =
    "$sidebarPath.bak-12-67e-$timestamp"

$settingsBackup =
    "$settingsPath.bak-12-67e-$timestamp"

Copy-Item `
    -LiteralPath $sidebarPath `
    -Destination $sidebarBackup `
    -Force

Copy-Item `
    -LiteralPath $settingsPath `
    -Destination $settingsBackup `
    -Force

try {
    [System.IO.File]::WriteAllText(
        $sidebarPath,
        $sidebarContent,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $settingsPath,
        $settingsContent,
        $utf8NoBom
    )
}
catch {
    Copy-Item `
        -LiteralPath $sidebarBackup `
        -Destination $sidebarPath `
        -Force

    Copy-Item `
        -LiteralPath $settingsBackup `
        -Destination $settingsPath `
        -Force

    throw
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.67e APPLIQUE"
Write-Host "======================================"
Write-Host ""
Write-Host "Sidebar : app/ui/AppSidebar.tsx"
Write-Host " - position FIXED reelle"
Write-Host " - largeur 18rem conservee"
Write-Host " - menu central scrollable"
Write-Host " - logo reste en haut"
Write-Host " - deconnexion reste en bas"
Write-Host ""
Write-Host "Telephone : app/settings/page.tsx"
Write-Host " - retire du return loading"
Write-Host " - ajoute au vrai contenu Settings"
Write-Host ""