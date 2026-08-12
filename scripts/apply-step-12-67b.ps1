$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $projectRoot "app\settings\page.tsx"

Write-Host ""
Write-Host "KLYX 12.67b - Fixed Sidebar + Phone Settings Link"
Write-Host ""

if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw "app/settings/page.tsx introuvable."
}

function Find-TagEnd {
    param(
        [string]$Text,
        [int]$StartIndex
    )

    $quote = [char]0

    for ($i = $StartIndex; $i -lt $Text.Length; $i++) {
        $char = $Text[$i]

        if ($quote -ne [char]0) {
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

# ============================================================
# 1. DETECTION SIDEBAR
# ============================================================

$searchRoots = @(
    (Join-Path $projectRoot "app"),
    (Join-Path $projectRoot "components")
)

$sidebarCandidates = @()

foreach ($root in $searchRoots) {
    if (-not (Test-Path -LiteralPath $root)) {
        continue
    }

    $files = Get-ChildItem `
        -LiteralPath $root `
        -Recurse `
        -File `
        -Filter "*.tsx"

    foreach ($file in $files) {
        $text = [System.IO.File]::ReadAllText(
            $file.FullName
        )

        $looksLikeSidebar =
            (
                $text.Contains("Se déconnecter") -or
                $text.Contains("Se deconnecter")
            ) -and
            (
                $text.Contains("Mon activité") -or
                $text.Contains("Mon activite") -or
                $text.Contains("Réservations & missions") -or
                $text.Contains("Reservations & missions")
            )

        if ($looksLikeSidebar) {
            $sidebarCandidates += @{
                Path = $file.FullName
                Text = $text
            }
        }
    }
}

if ($sidebarCandidates.Count -lt 1) {
    throw "Composant sidebar KLYX introuvable."
}

$sidebarItem = $sidebarCandidates[0]
$sidebarPath = $sidebarItem.Path
$sidebarContent = $sidebarItem.Text

Write-Host "Sidebar detectee :"
Write-Host $sidebarPath
Write-Host ""

$sidebarMarker =
    "KLYX_FIXED_APP_SIDEBAR_12_67B"

if (-not $sidebarContent.Contains($sidebarMarker)) {

    $tagIndex =
        $sidebarContent.IndexOf("<aside")

    if ($tagIndex -lt 0) {
        $returnIndex =
            $sidebarContent.IndexOf("return (")

        if ($returnIndex -lt 0) {
            throw "Root JSX de la sidebar introuvable."
        }

        $tagIndex =
            $sidebarContent.IndexOf(
                "<div",
                $returnIndex
            )

        if ($tagIndex -lt 0) {
            throw "Conteneur principal sidebar introuvable."
        }
    }

    $tagEnd =
        Find-TagEnd `
            -Text $sidebarContent `
            -StartIndex $tagIndex

    if ($tagEnd -lt 0) {
        throw "Fin du conteneur sidebar introuvable."
    }

    $tag =
        $sidebarContent.Substring(
            $tagIndex,
            $tagEnd - $tagIndex + 1
        )

    $classMatch =
        [regex]::Match(
            $tag,
            'className="([^"]*)"'
        )

    $fixedClasses =
        "sticky top-0 h-screen max-h-screen shrink-0 self-start overflow-hidden"

    if ($classMatch.Success) {
        $oldClasses =
            $classMatch.Groups[1].Value

        $newClasses =
            ($oldClasses + " " + $fixedClasses).Trim()

        $newTag =
            $tag.Substring(
                0,
                $classMatch.Groups[1].Index
            ) +
            $newClasses +
            $tag.Substring(
                $classMatch.Groups[1].Index +
                $classMatch.Groups[1].Length
            )
    }
    else {
        $newTag =
            $tag.Substring(
                0,
                $tag.Length - 1
            ) +
            ' className="' +
            $fixedClasses +
            '">'
    }

    $sidebarContent =
        $sidebarContent.Substring(
            0,
            $tagIndex
        ) +
        $newTag +
        $sidebarContent.Substring(
            $tagEnd + 1
        )

    $markerLines = @(
        ""
        "{/* KLYX_FIXED_APP_SIDEBAR_12_67B */}"
    )

    $markerText =
        [string]::Join(
            "`n",
            $markerLines
        )

    $newTagEnd =
        $tagIndex +
        $newTag.Length

    $sidebarContent =
        $sidebarContent.Substring(
            0,
            $newTagEnd
        ) +
        $markerText +
        $sidebarContent.Substring(
            $newTagEnd
        )
}

# ============================================================
# 2. AJOUT TELEPHONE DANS /settings
# ============================================================

$settingsContent =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$phoneMarker =
    "KLYX_PHONE_SETTINGS_ENTRY_12_67B"

if (-not $settingsContent.Contains($phoneMarker)) {

    $returnIndex =
        $settingsContent.IndexOf("return (")

    if ($returnIndex -lt 0) {
        throw "return JSX de settings introuvable."
    }

    $mainIndex =
        $settingsContent.IndexOf(
            "<main",
            $returnIndex
        )

    $divIndex =
        $settingsContent.IndexOf(
            "<div",
            $returnIndex
        )

    $rootIndex = -1

    if (
        $mainIndex -ge 0 -and
        $divIndex -ge 0
    ) {
        $rootIndex =
            [Math]::Min(
                $mainIndex,
                $divIndex
            )
    }
    elseif ($mainIndex -ge 0) {
        $rootIndex = $mainIndex
    }
    elseif ($divIndex -ge 0) {
        $rootIndex = $divIndex
    }

    if ($rootIndex -lt 0) {
        throw "Root JSX settings introuvable."
    }

    $rootEnd =
        Find-TagEnd `
            -Text $settingsContent `
            -StartIndex $rootIndex

    if ($rootEnd -lt 0) {
        throw "Fin root settings introuvable."
    }

    $phoneLines = @(
        ""
        "      {/* KLYX_PHONE_SETTINGS_ENTRY_12_67B */}"
        '      <a'
        '        href="/settings/phone"'
        '        className="mx-auto mb-6 flex w-full max-w-6xl flex-col gap-4 rounded-[28px] border border-violet-500/25 bg-violet-500/[0.06] p-6 transition hover:border-violet-500/50 hover:bg-violet-500/[0.09] sm:flex-row sm:items-center sm:justify-between"'
        '      >'
        '        <div>'
        '          <div className="flex flex-wrap items-center gap-3">'
        '            <h2 className="text-xl font-black">'
        '              Téléphone'
        '            </h2>'
        '            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">'
        '              Numéro privé'
        '            </span>'
        '          </div>'
        ''
        '          <p className="mt-2 text-sm leading-6 text-muted-foreground">'
        '            Ajoute ou modifie ton numéro pour pouvoir appeler la personne liée à une mission KLYX.'
        '          </p>'
        '        </div>'
        ''
        '        <span className="shrink-0 rounded-2xl bg-violet-600 px-5 py-3 text-center text-sm font-black text-white">'
        '          Gérer mon numéro'
        '        </span>'
        '      </a>'
    )

    $phoneBlock =
        [string]::Join(
            "`n",
            $phoneLines
        )

    $settingsContent =
        $settingsContent.Substring(
            0,
            $rootEnd + 1
        ) +
        $phoneBlock +
        $settingsContent.Substring(
            $rootEnd + 1
        )
}

# ============================================================
# 3. BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$sidebarBackup =
    "$sidebarPath.bak-12-67b-$timestamp"

$settingsBackup =
    "$settingsPath.bak-12-67b-$timestamp"

Copy-Item `
    -LiteralPath $sidebarPath `
    -Destination $sidebarBackup `
    -Force

Copy-Item `
    -LiteralPath $settingsPath `
    -Destination $settingsBackup `
    -Force

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

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
Write-Host "OK - KLYX 12.67b applique."
Write-Host "OK - sidebar fixe pendant le scroll."
Write-Host "OK - acces Telephone ajoute dans Parametres."
Write-Host "OK - lien /settings/phone visible."
Write-Host ""