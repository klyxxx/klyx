$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.8 - LIGHT MODE + MOBILE SEARCH" -ForegroundColor Cyan
Write-Host ""

$search = "app\search\page.tsx"
$globals = "app\globals.css"

if (-not (Test-Path -LiteralPath $search)) { throw "$search introuvable" }
if (-not (Test-Path -LiteralPath $globals)) { throw "$globals introuvable" }

if (-not (Test-Path -LiteralPath "$search.12-8.bak")) {
  Copy-Item -LiteralPath $search -Destination "$search.12-8.bak"
}
if (-not (Test-Path -LiteralPath "$globals.12-8.bak")) {
  Copy-Item -LiteralPath $globals -Destination "$globals.12-8.bak"
}

$searchContent = Get-Content -LiteralPath $search -Raw

$searchContent = $searchContent.Replace(
'    <main className="min-h-screen overflow-x-hidden bg-zinc-950 px-3 py-5 text-white sm:px-5 sm:py-8">',
'    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-5 text-foreground sm:px-5 sm:py-8">'
)

$searchContent = $searchContent.Replace(
'          className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6"',
'          className="mt-8 min-w-0 overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6"'
)

$searchContent = $searchContent.Replace(
'            <p className="mt-3 max-w-2xl text-zinc-400">',
'            <p className="mt-3 max-w-2xl text-muted-foreground">'
)

$searchContent = $searchContent.Replace(
'              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"',
'              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"'
)

$searchContent = $searchContent.Replace(
'                className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700"',
'                className="flex min-w-0 w-full items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"'
)

$searchContent = $searchContent.Replace(
'      <span className="mb-2 flex items-center gap-2 text-sm text-zinc-300">',
'      <span className="mb-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">'
)

$searchContent = $searchContent.Replace(
'    <label className="block">',
'    <label className="block min-w-0 overflow-hidden">'
)

$searchContent = $searchContent.Replace(
'      {children}',
'      <span className="block min-w-0 max-w-full">{children}</span>'
)

$searchContent = $searchContent.Replace(
'    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">',
'    <div className="min-w-0 rounded-xl border border-border bg-card p-4">'
)

$searchContent = $searchContent.Replace(
'      <div className="flex items-center gap-2 text-sm text-zinc-500">',
'      <div className="flex items-center gap-2 text-sm text-muted-foreground">'
)

$searchContent = $searchContent.Replace(
'      <p className="mt-2 truncate font-semibold">{value}</p>',
'      <p className="mt-2 truncate font-semibold text-card-foreground">{value}</p>'
)

$searchContent = $searchContent.Replace(
'        <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">',
'        <main className="flex min-h-screen items-center justify-center bg-background text-foreground">'
)

[System.IO.File]::WriteAllText(
  (Resolve-Path $search),
  $searchContent,
  [System.Text.UTF8Encoding]::new($false)
)

$css = Get-Content -LiteralPath $globals -Raw

# Retire uniquement les règles qui forçaient le mode sombre partout.
$css = $css.Replace(
'select,
.klyx-input,
.filter-control {
color-scheme: dark;
}

select {
background-color: rgb(18 18 24);
color: rgb(250 250 250);
border-color: rgb(63 63 70);
}

select:hover,
select:focus {
border-color: rgb(139 92 246);
outline: none;
}

select option,
select optgroup {
background: rgb(24 24 27);
color: rgb(250 250 250);
}

select option:checked {
background: rgb(109 40 217);
color: white;
}
',
''
)

$patch = @'

/* KLYX 12.8 - Light mode + mobile search */
:root {
  color-scheme: light;
}

.dark {
  color-scheme: dark;
}

html,
body {
  max-width: 100%;
  overflow-x: hidden;
}

.klyx-input,
.filter-control,
input,
textarea,
select {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.klyx-input,
.filter-control,
select {
  color-scheme: inherit;
}

select {
  background-color: var(--background);
  color: var(--foreground);
  border-color: var(--border);
}

.dark select {
  background-color: rgb(24 24 27);
  color: rgb(250 250 250);
  border-color: rgb(63 63 70);
}

select option,
select optgroup {
  background: white;
  color: rgb(24 24 27);
}

.dark select option,
.dark select optgroup {
  background: rgb(24 24 27);
  color: rgb(250 250 250);
}

select option:checked {
  background: rgb(109 40 217);
  color: white;
}

input[type="date"],
input[type="time"] {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 640px) {
  input[type="date"],
  input[type="time"] {
    padding-left: 0.75rem;
    padding-right: 0.5rem;
  }
}
'@

if ($css -notmatch "KLYX 12\.8 - Light mode") {
  $css = $css.TrimEnd() + "`r`n" + $patch + "`r`n"
}

[System.IO.File]::WriteAllText(
  (Resolve-Path $globals),
  $css,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Search light mode corrige" -ForegroundColor Green
Write-Host "[OK] Date/heure mobile proteges" -ForegroundColor Green
Write-Host "[OK] Selects clair/sombre corriges" -ForegroundColor Green
