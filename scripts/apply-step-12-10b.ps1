$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.10B - LIGHT PROFILES + MOBILE DATE/TIME" -ForegroundColor Cyan
Write-Host ""

$globalsPath = "app\globals.css"

if (-not (Test-Path -LiteralPath $globalsPath)) {
  throw "app\globals.css introuvable."
}

$globals = Get-Content -LiteralPath $globalsPath -Raw
$marker = "/* KLYX 12.10B - LIGHT PROFILES + MOBILE FIELDS */"

if ($globals -match [regex]::Escape($marker)) {
  Write-Host "[OK] 12.10B deja appliquee." -ForegroundColor Green
  exit 0
}

$patch = @'

/* KLYX 12.10B - LIGHT PROFILES + MOBILE FIELDS */

/* -------------------------------------------------------
   1. MODE CLAIR : cartes/profils encore gris ou sombres
   ------------------------------------------------------- */

html:not(.dark) .klyx-app-content article,
html:not(.dark) .klyx-app-content section,
html:not(.dark) .klyx-app-content aside,
html:not(.dark) .klyx-app-content form {
  color: var(--foreground);
}

/* Neutralise les anciennes surfaces sombres uniquement en mode clair. */
html:not(.dark) .klyx-app-content [class*="bg-zinc-950"],
html:not(.dark) .klyx-app-content [class*="bg-neutral-950"],
html:not(.dark) .klyx-app-content [class*="bg-stone-950"] {
  background-color: var(--background) !important;
}

html:not(.dark) .klyx-app-content [class*="bg-zinc-900"],
html:not(.dark) .klyx-app-content [class*="bg-neutral-900"],
html:not(.dark) .klyx-app-content [class*="bg-stone-900"] {
  background-color: var(--card) !important;
}

html:not(.dark) .klyx-app-content [class*="bg-zinc-800"],
html:not(.dark) .klyx-app-content [class*="bg-neutral-800"],
html:not(.dark) .klyx-app-content [class*="bg-stone-800"] {
  background-color: var(--muted) !important;
}

/* Bordures legacy */
html:not(.dark) .klyx-app-content [class*="border-zinc-800"],
html:not(.dark) .klyx-app-content [class*="border-zinc-700"],
html:not(.dark) .klyx-app-content [class*="border-neutral-800"],
html:not(.dark) .klyx-app-content [class*="border-neutral-700"] {
  border-color: var(--border) !important;
}

/* Texte legacy */
html:not(.dark) .klyx-app-content [class*="text-zinc-100"],
html:not(.dark) .klyx-app-content [class*="text-zinc-200"],
html:not(.dark) .klyx-app-content [class*="text-zinc-300"],
html:not(.dark) .klyx-app-content [class*="text-neutral-100"],
html:not(.dark) .klyx-app-content [class*="text-neutral-200"],
html:not(.dark) .klyx-app-content [class*="text-neutral-300"] {
  color: var(--foreground) !important;
}

html:not(.dark) .klyx-app-content [class*="text-zinc-400"],
html:not(.dark) .klyx-app-content [class*="text-zinc-500"],
html:not(.dark) .klyx-app-content [class*="text-zinc-600"],
html:not(.dark) .klyx-app-content [class*="text-neutral-400"],
html:not(.dark) .klyx-app-content [class*="text-neutral-500"],
html:not(.dark) .klyx-app-content [class*="text-neutral-600"] {
  color: var(--muted-foreground) !important;
}

/* Les cartes de profil doivent rester blanches/claires. */
html:not(.dark) .klyx-app-content article[class*="rounded"],
html:not(.dark) .klyx-app-content section[class*="rounded"][class*="border"],
html:not(.dark) .klyx-app-content aside[class*="rounded"][class*="border"] {
  background-color: var(--card);
  border-color: var(--border);
}

/* -------------------------------------------------------
   2. INPUTS DATE / TIME : Safari / iPhone / petits ecrans
   ------------------------------------------------------- */

input[type="date"],
input[type="time"] {
  display: block;
  inline-size: 100%;
  width: 100%;
  max-inline-size: 100%;
  max-width: 100%;
  min-inline-size: 0;
  min-width: 0;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--foreground);
  background-color: color-mix(in oklab, var(--background) 82%, transparent);
}

.dark input[type="date"],
.dark input[type="time"] {
  color-scheme: dark;
}

html:not(.dark) input[type="date"],
html:not(.dark) input[type="time"] {
  color-scheme: light;
}

input[type="date"]::-webkit-date-and-time-value,
input[type="time"]::-webkit-date-and-time-value {
  min-width: 0;
  width: 100%;
  text-align: left;
}

input[type="date"]::-webkit-datetime-edit,
input[type="time"]::-webkit-datetime-edit {
  min-width: 0;
  padding: 0;
}

input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator {
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
  opacity: 0.72;
}

/* Tous les parents directs des controles doivent pouvoir retrecir. */
.klyx-app-content label,
.klyx-app-content form,
.klyx-app-content fieldset,
.klyx-app-content .grid,
.klyx-app-content .flex {
  min-width: 0;
}

@media (max-width: 640px) {
  .klyx-app-content input[type="date"],
  .klyx-app-content input[type="time"] {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    inline-size: 100% !important;
    max-inline-size: 100% !important;
    min-inline-size: 0 !important;
    margin: 0 !important;
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
  }

  .klyx-app-content input,
  .klyx-app-content select,
  .klyx-app-content textarea {
    max-width: 100%;
    min-width: 0;
  }
}

/* -------------------------------------------------------
   3. MENU MOBILE
   ------------------------------------------------------- */

html:not(.dark) button[aria-label="Ouvrir le menu"],
html:not(.dark) button[aria-label="Fermer le menu"] {
  color: #09090b !important;
}

.dark button[aria-label="Ouvrir le menu"],
.dark button[aria-label="Fermer le menu"] {
  color: #ffffff !important;
}
'@

$globals = $globals.TrimEnd() + "`r`n`r`n" + $patch + "`r`n"

[System.IO.File]::WriteAllText(
  (Resolve-Path $globalsPath),
  $globals,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Cartes/profils mode clair corriges." -ForegroundColor Green
Write-Host "[OK] Date/heure Safari mobile corriges." -ForegroundColor Green
Write-Host "[OK] Hamburger clair/sombre force." -ForegroundColor Green
Write-Host ""
Write-Host "Aucune logique metier modifiee." -ForegroundColor Cyan
