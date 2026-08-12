$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$settingsPath = Join-Path $projectRoot "app\settings\page.tsx"
$phoneComponentPath = Join-Path $projectRoot "app\settings\PhoneSettingsInline.tsx"
$globalsPath = Join-Path $projectRoot "app\globals.css"

Write-Host ""
Write-Host "KLYX 12.67c - Visible Phone + Real Fixed Sidebar"
Write-Host ""

if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw "app/settings/page.tsx introuvable."
}

if (-not (Test-Path -LiteralPath $globalsPath)) {
    throw "app/globals.css introuvable."
}

function Find-TagEnd {
    param(
        [string]$Text,
        [int]$StartIndex
    )

    $quote = [char]0
    $escaped = $false

    for ($i = $StartIndex; $i -lt $Text.Length; $i++) {
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

# ============================================================
# 1. COMPOSANT TELEPHONE VISIBLE DIRECTEMENT DANS SETTINGS
# ============================================================

$phoneLines = @(
    '"use client";'
    ''
    'import { useEffect, useMemo, useState } from "react";'
    'import { createBrowserClient } from "@supabase/ssr";'
    'import { CheckCircle2, LoaderCircle, Phone, Save, ShieldCheck } from "lucide-react";'
    ''
    '// KLYX_PHONE_INLINE_12_67C'
    ''
    'type PhonePayload = {'
    '  phoneNumber?: string | null;'
    '  verified?: boolean;'
    '  error?: string;'
    '};'
    ''
    'export default function PhoneSettingsInline() {'
    '  const supabase = useMemo(() => {'
    '    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;'
    '    const key ='
    '      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??'
    '      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;'
    ''
    '    if (!url || !key) {'
    '      throw new Error("Configuration Supabase manquante.");'
    '    }'
    ''
    '    return createBrowserClient(url, key);'
    '  }, []);'
    ''
    '  const [phoneNumber, setPhoneNumber] = useState("");'
    '  const [verified, setVerified] = useState(false);'
    '  const [loading, setLoading] = useState(true);'
    '  const [saving, setSaving] = useState(false);'
    '  const [message, setMessage] = useState("");'
    '  const [errorMessage, setErrorMessage] = useState("");'
    ''
    '  async function getToken() {'
    '    const { data } = await supabase.auth.getSession();'
    '    return data.session?.access_token ?? null;'
    '  }'
    ''
    '  useEffect(() => {'
    '    let mounted = true;'
    ''
    '    async function loadPhone() {'
    '      try {'
    '        const token = await getToken();'
    ''
    '        if (!token) {'
    '          throw new Error("Session KLYX introuvable.");'
    '        }'
    ''
    '        const response = await fetch("/api/profile/phone", {'
    '          cache: "no-store",'
    '          headers: {'
    '            Authorization: "Bearer " + token,'
    '          },'
    '        });'
    ''
    '        const result = (await response.json()) as PhonePayload;'
    ''
    '        if (!response.ok) {'
    '          throw new Error(result.error || "Chargement impossible.");'
    '        }'
    ''
    '        if (!mounted) return;'
    ''
    '        setPhoneNumber(result.phoneNumber ?? "");'
    '        setVerified(Boolean(result.verified));'
    '      } catch (error) {'
    '        if (!mounted) return;'
    ''
    '        setErrorMessage('
    '          error instanceof Error'
    '            ? error.message'
    '            : "Chargement impossible."'
    '        );'
    '      } finally {'
    '        if (mounted) setLoading(false);'
    '      }'
    '    }'
    ''
    '    void loadPhone();'
    ''
    '    return () => {'
    '      mounted = false;'
    '    };'
    '  }, [supabase]);'
    ''
    '  async function savePhone() {'
    '    setSaving(true);'
    '    setMessage("");'
    '    setErrorMessage("");'
    ''
    '    try {'
    '      const token = await getToken();'
    ''
    '      if (!token) {'
    '        throw new Error("Session KLYX introuvable.");'
    '      }'
    ''
    '      const response = await fetch("/api/profile/phone", {'
    '        method: "PUT",'
    '        headers: {'
    '          "Content-Type": "application/json",'
    '          Authorization: "Bearer " + token,'
    '        },'
    '        body: JSON.stringify({'
    '          phoneNumber,'
    '        }),'
    '      });'
    ''
    '      const result = (await response.json()) as PhonePayload;'
    ''
    '      if (!response.ok) {'
    '        throw new Error(result.error || "Enregistrement impossible.");'
    '      }'
    ''
    '      setPhoneNumber(result.phoneNumber ?? "");'
    '      setVerified(Boolean(result.verified));'
    '      setMessage("Numero enregistre avec succes.");'
    '    } catch (error) {'
    '      setErrorMessage('
    '        error instanceof Error'
    '          ? error.message'
    '          : "Enregistrement impossible."'
    '      );'
    '    } finally {'
    '      setSaving(false);'
    '    }'
    '  }'
    ''
    '  return ('
    '    <section className="mb-7 rounded-[30px] border border-violet-500/30 bg-violet-500/[0.05] p-6 sm:p-7">'
    '      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">'
    '        <div className="flex gap-4">'
    '          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">'
    '            <Phone size={21} />'
    '          </div>'
    ''
    '          <div>'
    '            <div className="flex flex-wrap items-center gap-3">'
    '              <h2 className="text-xl font-black">'
    '                Numero de telephone'
    '              </h2>'
    ''
    '              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">'
    '                Prive'
    '              </span>'
    '            </div>'
    ''
    '            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">'
    '              Client et prestataire pourront utiliser ce numero uniquement lorsqu une mission KLYX autorise le contact.'
    '            </p>'
    '          </div>'
    '        </div>'
    ''
    '        <ShieldCheck'
    '          size={22}'
    '          className="hidden shrink-0 text-emerald-500 sm:block"'
    '        />'
    '      </div>'
    ''
    '      {loading ? ('
    '        <div className="mt-6 flex items-center gap-3 text-sm font-bold text-muted-foreground">'
    '          <LoaderCircle size={19} className="animate-spin" />'
    '          Chargement du numero...'
    '        </div>'
    '      ) : ('
    '        <div className="mt-6">'
    '          <div className="flex flex-col gap-3 lg:flex-row">'
    '            <input'
    '              type="tel"'
    '              inputMode="tel"'
    '              autoComplete="tel"'
    '              value={phoneNumber}'
    '              onChange={(event) => {'
    '                setPhoneNumber(event.target.value);'
    '                setMessage("");'
    '                setErrorMessage("");'
    '              }}'
    '              placeholder="+32471503513"'
    '              className="h-13 min-w-0 flex-1 rounded-2xl border border-border bg-background px-5 text-base font-bold outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"'
    '            />'
    ''
    '            <button'
    '              type="button"'
    '              disabled={saving}'
    '              onClick={() => {'
    '                void savePhone();'
    '              }}'
    '              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:opacity-60"'
    '            >'
    '              {saving ? ('
    '                <LoaderCircle size={18} className="animate-spin" />'
    '              ) : ('
    '                <Save size={18} />'
    '              )}'
    ''
    '              Enregistrer le numero'
    '            </button>'
    '          </div>'
    ''
    '          <div className="mt-3 flex flex-wrap items-center gap-3">'
    '            <span className="text-xs font-semibold text-muted-foreground">'
    '              Exemple Belgique : +32 471 50 35 13'
    '            </span>'
    ''
    '            {verified && ('
    '              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-500">'
    '                <CheckCircle2 size={15} />'
    '                Numero verifie'
    '              </span>'
    '            )}'
    '          </div>'
    ''
    '          {message && ('
    '            <div className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">'
    '              {message}'
    '            </div>'
    '          )}'
    ''
    '          {errorMessage && ('
    '            <div className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">'
    '              {errorMessage}'
    '            </div>'
    '          )}'
    '        </div>'
    '      )}'
    '    </section>'
    '  );'
    '}'
)

$phoneContent = [string]::Join(
    "`n",
    $phoneLines
)

# ============================================================
# 2. PATCH SETTINGS PAGE
# ============================================================

$settingsContent = [System.IO.File]::ReadAllText(
    $settingsPath
)

$settingsMarker =
    "KLYX_PHONE_VISIBLE_SETTINGS_12_67C"

if (-not $settingsContent.Contains($settingsMarker)) {

    $importLine =
        'import PhoneSettingsInline from "./PhoneSettingsInline";'

    if (-not $settingsContent.Contains($importLine)) {

        $directiveEnd = -1

        if ($settingsContent.StartsWith('"use client";')) {
            $directiveEnd = $settingsContent.IndexOf("`n") + 1
        }
        elseif ($settingsContent.StartsWith("'use client';")) {
            $directiveEnd = $settingsContent.IndexOf("`n") + 1
        }

        if ($directiveEnd -gt 0) {
            $settingsContent =
                $settingsContent.Substring(0, $directiveEnd) +
                $importLine +
                "`n" +
                $settingsContent.Substring($directiveEnd)
        }
        else {
            $settingsContent =
                $importLine +
                "`n" +
                $settingsContent
        }
    }

    $returnIndex =
        $settingsContent.IndexOf("return (")

    if ($returnIndex -lt 0) {
        throw "return settings introuvable."
    }

    $fragmentIndex =
        $settingsContent.IndexOf("<>", $returnIndex)

    $mainIndex =
        $settingsContent.IndexOf("<main", $returnIndex)

    $divIndex =
        $settingsContent.IndexOf("<div", $returnIndex)

    $sectionIndex =
        $settingsContent.IndexOf("<section", $returnIndex)

    $candidates = @()

    foreach ($index in @(
        $mainIndex,
        $divIndex,
        $sectionIndex
    )) {
        if ($index -ge 0) {
            $candidates += $index
        }
    }

    if (
        $fragmentIndex -ge 0 -and
        (
            $candidates.Count -eq 0 -or
            $fragmentIndex -lt ($candidates | Measure-Object -Minimum).Minimum
        )
    ) {
        $insertIndex =
            $fragmentIndex + 2
    }
    else {
        if ($candidates.Count -eq 0) {
            throw "Root JSX settings introuvable."
        }

        $rootIndex =
            ($candidates | Measure-Object -Minimum).Minimum

        $rootEnd =
            Find-TagEnd `
                -Text $settingsContent `
                -StartIndex $rootIndex

        if ($rootEnd -lt 0) {
            throw "Fin root JSX settings introuvable."
        }

        $insertIndex =
            $rootEnd + 1
    }

    $blockLines = @(
        ""
        "      {/* KLYX_PHONE_VISIBLE_SETTINGS_12_67C */}"
        "      <PhoneSettingsInline />"
    )

    $block =
        [string]::Join(
            "`n",
            $blockLines
        )

    $settingsContent =
        $settingsContent.Substring(
            0,
            $insertIndex
        ) +
        $block +
        $settingsContent.Substring(
            $insertIndex
        )
}

# ============================================================
# 3. TROUVER LA VRAIE SIDEBAR
# ============================================================

$sidebarCandidates = @()

$roots = @(
    (Join-Path $projectRoot "app"),
    (Join-Path $projectRoot "components")
)

foreach ($root in $roots) {

    if (-not (Test-Path -LiteralPath $root)) {
        continue
    }

    $files = Get-ChildItem `
        -LiteralPath $root `
        -Recurse `
        -File `
        -Filter "*.tsx"

    foreach ($file in $files) {

        $text =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )

        $score = 0

        foreach ($token in @(
            "Se déconnecter",
            "Se deconnecter",
            "Assistant professionnel",
            "Mon activité",
            "Mon activite",
            "Réservations & missions",
            "Reservations & missions",
            "Missions disponibles",
            "Planning intelligent"
        )) {
            if ($text.Contains($token)) {
                $score++
            }
        }

        if ($score -ge 3) {
            $sidebarCandidates += @{
                Path = $file.FullName
                Content = $text
                Score = $score
            }
        }
    }
}

if ($sidebarCandidates.Count -lt 1) {
    throw "Sidebar KLYX introuvable."
}

$sidebarItem =
    $sidebarCandidates |
    Sort-Object Score -Descending |
    Select-Object -First 1

$sidebarPath =
    $sidebarItem.Path

$sidebarContent =
    $sidebarItem.Content

Write-Host "Sidebar detectee :"
Write-Host $sidebarPath
Write-Host ""

$sidebarMarker =
    'data-klyx-fixed-sidebar="true"'

if (-not $sidebarContent.Contains($sidebarMarker)) {

    $returnIndex =
        $sidebarContent.IndexOf("return (")

    if ($returnIndex -lt 0) {
        throw "return sidebar introuvable."
    }

    $rootCandidates = @()

    foreach ($token in @(
        "<aside",
        "<nav",
        "<div",
        "<section"
    )) {
        $index =
            $sidebarContent.IndexOf(
                $token,
                $returnIndex
            )

        if ($index -ge 0) {
            $rootCandidates += $index
        }
    }

    if ($rootCandidates.Count -lt 1) {
        throw "Root HTML sidebar introuvable."
    }

    $rootIndex =
        ($rootCandidates | Measure-Object -Minimum).Minimum

    $rootEnd =
        Find-TagEnd `
            -Text $sidebarContent `
            -StartIndex $rootIndex

    if ($rootEnd -lt 0) {
        throw "Fin root sidebar introuvable."
    }

    $rootTag =
        $sidebarContent.Substring(
            $rootIndex,
            $rootEnd - $rootIndex + 1
        )

    $newRootTag =
        $rootTag.Substring(
            0,
            $rootTag.Length - 1
        ) +
        ' data-klyx-fixed-sidebar="true">'

    $sidebarContent =
        $sidebarContent.Substring(
            0,
            $rootIndex
        ) +
        $newRootTag +
        $sidebarContent.Substring(
            $rootEnd + 1
        )
}

# ============================================================
# 4. CSS FIXED REEL
# ============================================================

$globalsContent =
    [System.IO.File]::ReadAllText(
        $globalsPath
    )

$cssMarker =
    "KLYX_FIXED_SIDEBAR_12_67C"

if (-not $globalsContent.Contains($cssMarker)) {

    $cssLines = @(
        ""
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

    $cssBlock =
        [string]::Join(
            "`n",
            $cssLines
        )

    $globalsContent =
        $globalsContent.TrimEnd() +
        "`n" +
        $cssBlock +
        "`n"
}

# ============================================================
# 5. BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $settingsPath,
    $sidebarPath,
    $globalsPath,
    $phoneComponentPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination ($path + ".bak-12-67c-" + $timestamp) `
            -Force
    }
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $phoneComponentPath,
    $phoneContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $settingsPath,
    $settingsContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $sidebarPath,
    $sidebarContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $globalsPath,
    $globalsContent,
    $utf8NoBom
)

Write-Host ""
Write-Host "OK - telephone visible directement dans /settings."
Write-Host "OK - champ numero visible."
Write-Host "OK - bouton Enregistrer visible."
Write-Host "OK - sidebar position fixed."
Write-Host "OK - contenu decale de 312px sur desktop."
Write-Host ""