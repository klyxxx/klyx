$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$sidebarPath = Join-Path $projectRoot "app\ui\AppSidebar.tsx"
$settingsPath = Join-Path $projectRoot "app\settings\page.tsx"
$globalsPath = Join-Path $projectRoot "app\globals.css"

Write-Host ""
Write-Host "KLYX 12.67f - Sidebar + Phone Definitive Repair"
Write-Host ""

foreach ($path in @(
    $sidebarPath,
    $settingsPath,
    $globalsPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

$sidebar =
    [System.IO.File]::ReadAllText(
        $sidebarPath
    )

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$globals =
    [System.IO.File]::ReadAllText(
        $globalsPath
    )

$marker =
    "KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F"

if (
    $sidebar.Contains($marker) -and
    $settings.Contains($marker)
) {
    Write-Host "KLYX 12.67f deja applique."
    exit 0
}

# ============================================================
# 1. RETIRER LE MAUVAIS FIX DU BLOC LOGO
# ============================================================

$badHeader =
    'className="px-5 pb-4 pt-6" data-klyx-fixed-sidebar="true"'

$goodHeader =
    'className="shrink-0 px-5 pb-4 pt-6"'

if ($sidebar.Contains($badHeader)) {
    $sidebar =
        $sidebar.Replace(
            $badHeader,
            $goodHeader
        )
}
elseif ($sidebar.Contains(
    'className="px-5 pb-4 pt-6"'
)) {
    $sidebar =
        $sidebar.Replace(
            'className="px-5 pb-4 pt-6"',
            $goodHeader
        )
}

if ($sidebar.Contains(
    'data-klyx-fixed-sidebar="true"'
)) {
    throw "Ancien data-klyx-fixed-sidebar encore present."
}

# ============================================================
# 2. NAVIGATION : SEUL LE MENU PEUT SCROLLER
# ============================================================

$oldNav =
    'className="klyx-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2"'

$newNav =
    'className="klyx-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2"'

if ($sidebar.Contains($oldNav)) {
    $sidebar =
        $sidebar.Replace(
            $oldNav,
            $newNav
        )
}

# Footer toujours fixe en bas.
$oldFooter =
    '<div className="p-3">'

$newFooter =
    '<div className="shrink-0 p-3">'

$footerIndex =
    $sidebar.LastIndexOf($oldFooter)

if ($footerIndex -ge 0) {
    $sidebar =
        $sidebar.Substring(
            0,
            $footerIndex
        ) +
        $newFooter +
        $sidebar.Substring(
            $footerIndex +
            $oldFooter.Length
        )
}

# ============================================================
# 3. REMPLACER LE VRAI ASIDE DESKTOP
# ============================================================

$desktopMarker =
    "{/* KLYX_FIXED_APP_SIDEBAR_12_67B */}"

$desktopMarkerIndex =
    $sidebar.IndexOf(
        $desktopMarker
    )

if ($desktopMarkerIndex -lt 0) {
    throw "Marqueur vraie sidebar desktop introuvable."
}

$asideStart =
    $sidebar.LastIndexOf(
        "<aside",
        $desktopMarkerIndex
    )

if ($asideStart -lt 0) {
    throw "Aside desktop introuvable."
}

$asideEnd =
    $sidebar.IndexOf(
        ">",
        $asideStart
    )

if ($asideEnd -lt 0) {
    throw "Fin tag aside desktop introuvable."
}

$newAside =
    '<aside className="fixed inset-y-0 left-0 z-50 hidden h-dvh w-[18rem] flex-col overflow-hidden border-r border-border bg-card text-foreground dark:border-white/8 dark:bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] dark:text-white lg:flex">'

$sidebar =
    $sidebar.Substring(
        0,
        $asideStart
    ) +
    $newAside +
    $sidebar.Substring(
        $asideEnd + 1
    )

# ============================================================
# 4. AJOUTER UN SPACER POUR LE CONTENU
# ============================================================

$desktopMarkerIndex =
    $sidebar.IndexOf(
        $desktopMarker
    )

$desktopClose =
    $sidebar.IndexOf(
        "</aside>",
        $desktopMarkerIndex
    )

if ($desktopClose -lt 0) {
    throw "Fermeture sidebar desktop introuvable."
}

$desktopCloseEnd =
    $desktopClose +
    "</aside>".Length

$spacerMarker =
    "KLYX_SIDEBAR_SPACER_12_67F"

if (-not $sidebar.Contains($spacerMarker)) {

    $spacerLines = @(
        ""
        "      {/* KLYX_SIDEBAR_SPACER_12_67F */}"
        '      <div'
        '        aria-hidden="true"'
        '        className="hidden w-[18rem] shrink-0 lg:block"'
        '      />'
    )

    $spacer =
        [string]::Join(
            "`n",
            $spacerLines
        )

    $sidebar =
        $sidebar.Substring(
            0,
            $desktopCloseEnd
        ) +
        $spacer +
        $sidebar.Substring(
            $desktopCloseEnd
        )
}

$sidebar =
    $sidebar.Replace(
        $desktopMarker,
        $desktopMarker +
        "`n        {/* $marker */}"
    )

# ============================================================
# 5. RETIRER L'ANCIEN CSS GLOBAL CASSE
# ============================================================

$cssMarker =
    "/* KLYX_FIXED_SIDEBAR_REPAIR_12_67D */"

$cssIndex =
    $globals.IndexOf(
        $cssMarker
    )

if ($cssIndex -ge 0) {
    $globals =
        $globals.Substring(
            0,
            $cssIndex
        ).TrimEnd() +
        "`n"
}

if ($globals.Contains(
    '[data-klyx-fixed-sidebar="true"]'
)) {
    throw "Ancien CSS sidebar casse encore present."
}

# ============================================================
# 6. TELEPHONE : RETIRER DU LOADING
# ============================================================

$oldPhoneStart =
    "      {/* KLYX_PHONE_VISIBLE_SETTINGS_12_67C */}"

$oldPhoneIndex =
    $settings.IndexOf(
        $oldPhoneStart
    )

if ($oldPhoneIndex -ge 0) {

    $loaderIndex =
        $settings.IndexOf(
            "        <LoaderCircle",
            $oldPhoneIndex
        )

    if ($loaderIndex -lt 0) {
        throw "Loader settings introuvable."
    }

    $settings =
        $settings.Substring(
            0,
            $oldPhoneIndex
        ) +
        $settings.Substring(
            $loaderIndex
        )
}

# Nettoyer toute ancienne injection 12.67e eventuelle.
$settings =
    $settings.Replace(
        "      {/* KLYX_PHONE_REAL_SETTINGS_12_67E */}`n      <PhoneSettingsInline />`n",
        ""
    )

$settings =
    $settings.Replace(
        "      {/* KLYX_PHONE_REAL_SETTINGS_12_67E */}`r`n      <PhoneSettingsInline />`r`n",
        ""
    )

# ============================================================
# 7. TELEPHONE DANS LE VRAI CONTENU SETTINGS
# ============================================================

$settingsAnchor =
    '        <div className="mt-8 space-y-6">'

$anchorIndex =
    $settings.IndexOf(
        $settingsAnchor
    )

if ($anchorIndex -lt 0) {
    throw "Ancre reelle Settings introuvable."
}

$insertIndex =
    $anchorIndex +
    $settingsAnchor.Length

$phoneBlockLines = @(
    ""
    "          {/* KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F */}"
    "          <PhoneSettingsInline />"
)

$phoneBlock =
    [string]::Join(
        "`n",
        $phoneBlockLines
    )

if (-not $settings.Contains(
    "KLYX_REAL_SIDEBAR_PHONE_REPAIR_12_67F"
)) {
    $settings =
        $settings.Substring(
            0,
            $insertIndex
        ) +
        $phoneBlock +
        $settings.Substring(
            $insertIndex
        )
}

# ============================================================
# 8. VERIFICATIONS
# ============================================================

$phoneCount =
    [regex]::Matches(
        $settings,
        '<PhoneSettingsInline\s*/>'
    ).Count

if ($phoneCount -ne 1) {
    throw "PhoneSettingsInline doit etre present une seule fois. Trouve : $phoneCount"
}

if (-not $sidebar.Contains(
    "fixed inset-y-0 left-0 z-50"
)) {
    throw "Sidebar fixed absente."
}

if (-not $sidebar.Contains(
    "KLYX_SIDEBAR_SPACER_12_67F"
)) {
    throw "Spacer sidebar absent."
}

if (-not $sidebar.Contains(
    "min-h-0 flex-1 space-y-1 overflow-y-auto"
)) {
    throw "Scroll interne nav incorrect."
}

if (-not $sidebar.Contains(
    'className="shrink-0 px-5 pb-4 pt-6"'
)) {
    throw "Header sidebar non protege."
}

# ============================================================
# 9. BACKUPS + ECRITURE
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$sidebarBackup =
    "$sidebarPath.bak-12-67f-$timestamp"

$settingsBackup =
    "$settingsPath.bak-12-67f-$timestamp"

$globalsBackup =
    "$globalsPath.bak-12-67f-$timestamp"

Copy-Item $sidebarPath $sidebarBackup -Force
Copy-Item $settingsPath $settingsBackup -Force
Copy-Item $globalsPath $globalsBackup -Force

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $sidebarPath,
        $sidebar,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $settingsPath,
        $settings,
        $utf8NoBom
    )

    [System.IO.File]::WriteAllText(
        $globalsPath,
        $globals,
        $utf8NoBom
    )
}
catch {
    Copy-Item $sidebarBackup $sidebarPath -Force
    Copy-Item $settingsBackup $settingsPath -Force
    Copy-Item $globalsBackup $globalsPath -Force
    throw
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.67f APPLIQUE"
Write-Host "======================================"
Write-Host "Sidebar fixe reelle."
Write-Host "Logo fixe en haut."
Write-Host "Deconnexion fixe en bas."
Write-Host "Menu central scrollable."
Write-Host "Ancien CSS casse supprime."
Write-Host "Telephone visible dans Settings."
Write-Host ""