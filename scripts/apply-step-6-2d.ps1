$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sidebar = Join-Path $root "app\ui\AppSidebar.tsx"
$globals = Join-Path $root "app\globals.css"

if (-not (Test-Path -LiteralPath $sidebar)) {
  throw "Fichier introuvable : app\ui\AppSidebar.tsx"
}

if (-not (Test-Path -LiteralPath $globals)) {
  throw "Fichier introuvable : app\globals.css"
}

Copy-Item -LiteralPath $sidebar -Destination "$sidebar.step-6-2d.backup" -Force
Copy-Item -LiteralPath $globals -Destination "$globals.step-6-2d.backup" -Force

$sidebarContent = Get-Content -LiteralPath $sidebar -Raw -Encoding UTF8

$patterns = @(
  '(?m)^\s*\{\s*title:\s*"Missions",\s*href:\s*"/bookings"[^}]*\},\s*\r?\n?',
  "(?m)^\s*\{\s*title:\s*'Missions',\s*href:\s*'/bookings'[^}]*\},\s*\r?\n?"
)

foreach ($pattern in $patterns) {
  $sidebarContent = [regex]::Replace(
    $sidebarContent,
    $pattern,
    ""
  )
}

$sidebarContent = $sidebarContent.Replace(
  'title: "Demandes reçues", href: "/bookings"',
  'title: "Réservations & missions", href: "/bookings"'
)

$sidebarContent = $sidebarContent.Replace(
  "title: 'Demandes reçues', href: '/bookings'",
  "title: 'Réservations & missions', href: '/bookings'"
)

Set-Content -LiteralPath $sidebar -Value $sidebarContent -Encoding UTF8

$globalsContent = Get-Content -LiteralPath $globals -Raw -Encoding UTF8
$marker = "/* KLYX STEP 6.2D SELECTS */"

if (-not $globalsContent.Contains($marker)) {
  $css = @'

/* KLYX STEP 6.2D SELECTS */
select,
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

button,
a,
input,
select,
textarea {
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    opacity 160ms ease,
    transform 160ms ease;
}

button:active:not(:disabled),
a:active {
  transform: scale(0.985);
}
'@

  Add-Content -LiteralPath $globals -Value $css -Encoding UTF8
}

Write-Host ""
Write-Host "Etape 6.2D appliquee avec succes." -ForegroundColor Green
Write-Host "Les boutons prestataire /bookings ont ete regroupes."
Write-Host "Les menus select ont maintenant un rendu sombre KLYX."
Write-Host "Sauvegardes creees pour AppSidebar.tsx et globals.css."
Write-Host "Execute maintenant : npm run build"
