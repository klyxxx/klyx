$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.10C - DIRECT THEME FIX" -ForegroundColor Cyan
Write-Host ""

function Replace-Exact {
  param(
    [string]$Path,
    [string]$Old,
    [string]$New,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Fichier introuvable : $Path"
  }

  $content = Get-Content -LiteralPath $Path -Raw

  if ($content.Contains($New)) {
    Write-Host "[OK] $Label deja applique." -ForegroundColor Green
    return
  }

  if (-not $content.Contains($Old)) {
    throw "Bloc attendu introuvable pour : $Label"
  }

  $content = $content.Replace($Old, $New)

  [System.IO.File]::WriteAllText(
    (Resolve-Path $Path),
    $content,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host "[OK] $Label" -ForegroundColor Green
}

# ------------------------------------------------------------------
# 1. ROOT CAUSE :
# klyx-visual-system.css appliquait un gradient sombre aux classes
# contenant bg-zinc-900 MEME quand elles etaient prefixees par dark:.
# ------------------------------------------------------------------

$oldVisual = @'
/* Anciennes cartes sombres de /search, /bookings, etc. */
.klyx-app-content article[class*="bg-zinc-900"],
.klyx-app-content section[class*="bg-zinc-900"],
.klyx-app-content div[class*="bg-zinc-900"] {
  border-color: rgba(255, 255, 255, 0.09) !important;
  background:
    linear-gradient(
      145deg,
      rgba(24, 24, 31, 0.88),
      rgba(16, 19, 31, 0.76)
    ) !important;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(20px);
}
'@

$newVisual = @'
/* Anciennes cartes sombres de /search, /bookings, etc.
   IMPORTANT : uniquement quand le theme sombre est reellement actif. */
.dark .klyx-app-content article[class*="bg-zinc-900"],
.dark .klyx-app-content section[class*="bg-zinc-900"],
.dark .klyx-app-content div[class*="bg-zinc-900"] {
  border-color: rgba(255, 255, 255, 0.09) !important;
  background:
    linear-gradient(
      145deg,
      rgba(24, 24, 31, 0.88),
      rgba(16, 19, 31, 0.76)
    ) !important;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(20px);
}

/* En mode clair, les anciennes cartes doivent rester de vraies cartes claires. */
html:not(.dark) .klyx-app-content article[class*="dark:bg-zinc-900"],
html:not(.dark) .klyx-app-content section[class*="dark:bg-zinc-900"],
html:not(.dark) .klyx-app-content div[class*="dark:bg-zinc-900"] {
  border-color: var(--border) !important;
  background: var(--card) !important;
  box-shadow:
    0 18px 55px rgba(24, 24, 27, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
'@

Replace-Exact `
  -Path "app\klyx-visual-system.css" `
  -Old $oldVisual `
  -New $newVisual `
  -Label "Visual system : cartes sombres limitees au dark mode"

# ------------------------------------------------------------------
# 2. FAVORIS :
# CTA violets doivent garder un texte blanc.
# Violet du libelle plus lisible en clair.
# ------------------------------------------------------------------

$favoritesPath = "app\favorites\page.tsx"
$fav = Get-Content -LiteralPath $favoritesPath -Raw

$fav = $fav.Replace(
  'className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black transition hover:bg-violet-700"',
  'className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-700"'
)

$fav = $fav.Replace(
  'className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black transition hover:bg-violet-700"',
  'className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-700"'
)

$fav = $fav.Replace(
  'className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black transition hover:bg-violet-700"',
  'className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-700"'
)

$fav = $fav.Replace(
  'className="truncate text-sm font-bold text-violet-300"',
  'className="truncate text-sm font-bold text-violet-700 dark:text-violet-300"'
)

[System.IO.File]::WriteAllText(
  (Resolve-Path $favoritesPath),
  $fav,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Favoris : carte claire + CTA blancs" -ForegroundColor Green

# ------------------------------------------------------------------
# 3. SEARCH :
# CTA violets blancs, messages clair/sombre lisibles.
# ------------------------------------------------------------------

$searchPath = "app\search\page.tsx"
$search = Get-Content -LiteralPath $searchPath -Raw

$search = $search.Replace(
  'className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-semibold hover:bg-violet-700"',
  'className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-4 font-semibold text-white hover:bg-violet-700"'
)

$search = $search.Replace(
  'className="mt-6 rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-700"',
  'className="mt-6 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"'
)

$search = $search.Replace(
  'className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-3 font-semibold text-violet-200 hover:bg-violet-500/20"',
  'className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 font-semibold text-violet-700 hover:bg-violet-500/15 dark:border-violet-500/40 dark:text-violet-200 dark:hover:bg-violet-500/20"'
)

$search = $search.Replace(
  'className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200"',
  'className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-800 dark:text-amber-200"'
)

$search = $search.Replace(
  'className="mt-1 text-sm text-amber-100/80"',
  'className="mt-1 text-sm text-amber-800/80 dark:text-amber-100/80"'
)

$search = $search.Replace(
  'className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300"',
  'className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300"'
)

[System.IO.File]::WriteAllText(
  (Resolve-Path $searchPath),
  $search,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Search : cartes claires + CTA/messages lisibles" -ForegroundColor Green

# ------------------------------------------------------------------
# 4. SIDEBAR :
# Cette fois le theme clair s'applique aussi a la sidebar desktop/mobile.
# ------------------------------------------------------------------

$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

$sidebar = $sidebar.Replace(
  'className="grid h-11 w-11 place-items-center rounded-2xl border border-border dark:border-white/10 bg-white/5 text-white"',
  'className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white"'
)

$sidebar = $sidebar.Replace(
  'className="hidden h-screen w-[18rem] shrink-0 flex-col border-r border-white/8 bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] lg:sticky lg:top-0 lg:flex"',
  'className="hidden h-screen w-[18rem] shrink-0 flex-col border-r border-border bg-card text-foreground dark:border-white/8 dark:bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] dark:text-white lg:sticky lg:top-0 lg:flex"'
)

$sidebar = $sidebar.Replace(
  'className="relative flex h-full w-[min(88vw,330px)] flex-col bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] shadow-2xl"',
  'className="relative flex h-full w-[min(88vw,330px)] flex-col bg-card text-foreground shadow-2xl dark:bg-[linear-gradient(180deg,#15131d_0%,#0b0a0f_100%)] dark:text-white"'
)

$sidebar = $sidebar.Replace(
  'className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/7 text-white"',
  'className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground dark:bg-white/7 dark:text-white"'
)

$sidebar = $sidebar.Replace(
  'className="h-11 w-full rounded-xl border border-border dark:border-white/10 bg-white/[0.055] pl-9 pr-12 text-sm text-white outline-none placeholder:text-muted-foreground dark:text-white/35 focus:border-violet-400/40"',
  'className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-400/40 dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:placeholder:text-white/35"'
)

$sidebar = $sidebar.Replace(
  'className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border dark:border-white/10 bg-[#0f0e14] p-1.5 shadow-2xl"',
  'className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#0f0e14]"'
)

$sidebar = $sidebar.Replace(
  ': "text-muted-foreground dark:text-white/62 hover:bg-white/7 hover:text-white"',
  ': "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/62 dark:hover:bg-white/7 dark:hover:text-white"'
)

$sidebar = $sidebar.Replace(
  'className="rounded-2xl border border-white/8 bg-white/[0.035] p-2"',
  'className="rounded-2xl border border-border bg-muted/40 p-2 dark:border-white/8 dark:bg-white/[0.035]"'
)

[System.IO.File]::WriteAllText(
  (Resolve-Path $sidebarPath),
  $sidebar,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Sidebar desktop/mobile : clair + sombre" -ForegroundColor Green

Write-Host ""
Write-Host "12.10C appliquee sans couche CSS globale supplementaire." -ForegroundColor Cyan
