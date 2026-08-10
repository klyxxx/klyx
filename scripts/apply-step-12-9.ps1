$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.9 - GLOBAL LIGHT MODE" -ForegroundColor Cyan
Write-Host ""

$globalsPath = "app\globals.css"
$logoPath = "app\ui\KlyxLogo.tsx"

if (-not (Test-Path -LiteralPath $globalsPath)) { throw "app\globals.css introuvable." }
if (-not (Test-Path -LiteralPath $logoPath)) { throw "app\ui\KlyxLogo.tsx introuvable." }

$globals = Get-Content -LiteralPath $globalsPath -Raw
if ($globals -match "KLYX 12\.9 - GLOBAL LIGHT MODE") {
  Write-Host "[OK] 12.9 deja appliquee." -ForegroundColor Green
  exit 0
}

$patterns = @(
  @("(?<!dark:)bg-zinc-950/95","bg-background/95 dark:bg-zinc-950/95"),
  @("(?<!dark:)bg-zinc-950/90","bg-background/90 dark:bg-zinc-950/90"),
  @("(?<!dark:)bg-zinc-950/85","bg-background/85 dark:bg-zinc-950/85"),
  @("(?<!dark:)bg-zinc-950/80","bg-background/80 dark:bg-zinc-950/80"),
  @("(?<!dark:)bg-zinc-950/70","bg-background/70 dark:bg-zinc-950/70"),
  @("(?<!dark:)bg-zinc-950/60","bg-background/60 dark:bg-zinc-950/60"),
  @("(?<!dark:)bg-zinc-950","bg-background dark:bg-zinc-950"),
  @("(?<!dark:)bg-zinc-900/80","bg-card/80 dark:bg-zinc-900/80"),
  @("(?<!dark:)bg-zinc-900/70","bg-card/70 dark:bg-zinc-900/70"),
  @("(?<!dark:)bg-zinc-900/60","bg-card/60 dark:bg-zinc-900/60"),
  @("(?<!dark:)bg-zinc-900","bg-card dark:bg-zinc-900"),
  @("(?<!dark:)bg-zinc-800","bg-muted dark:bg-zinc-800"),
  @("(?<!dark:)border-zinc-800","border-border dark:border-zinc-800"),
  @("(?<!dark:)border-zinc-700","border-border dark:border-zinc-700"),
  @("(?<!dark:)text-zinc-100","text-foreground dark:text-zinc-100"),
  @("(?<!dark:)text-zinc-300","text-foreground/80 dark:text-zinc-300"),
  @("(?<!dark:)text-zinc-400","text-muted-foreground dark:text-zinc-400"),
  @("(?<!dark:)text-zinc-500","text-muted-foreground dark:text-zinc-500"),
  @("(?<!dark:)hover:bg-zinc-900","hover:bg-muted dark:hover:bg-zinc-900"),
  @("(?<!dark:)hover:bg-zinc-800","hover:bg-muted dark:hover:bg-zinc-800"),
  @("(?<!dark:)hover:border-zinc-700","hover:border-foreground/20 dark:hover:border-zinc-700"),
  @("(?<!dark:)bg-\[#09090b\]","bg-background dark:bg-[#09090b]")
)

$changed = 0
$files = Get-ChildItem .\app -Recurse -File -Filter "*.tsx"

foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  $original = $content

  foreach ($pair in $patterns) {
    $content = [regex]::Replace($content, $pair[0], $pair[1])
  }

  $lines = $content -split "`r?`n"

  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]

    $keepWhite =
      $line -match "bg-violet-" -or
      $line -match "bg-indigo-" -or
      $line -match "bg-blue-" -or
      $line -match "bg-cyan-" -or
      $line -match "bg-emerald-" -or
      $line -match "bg-green-" -or
      $line -match "bg-red-" -or
      $line -match "bg-rose-" -or
      $line -match "bg-amber-" -or
      $line -match "bg-orange-" -or
      $line -match "bg-black" -or
      $line -match "bg-gradient-to-" -or
      $line -match "bg-\[linear-gradient" -or
      $line -match "bg-white/"

    if (-not $keepWhite) {
      $line = [regex]::Replace($line, "(?<!dark:)text-white(?!/)", "text-foreground dark:text-white")
      $line = [regex]::Replace($line, "(?<!dark:)hover:text-white", "hover:text-foreground dark:hover:text-white")
    }

    $lines[$i] = $line
  }

  $content = $lines -join "`r`n"

  if ($content -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
    $changed++
  }
}

$logo = Get-Content -LiteralPath $logoPath -Raw
$logo = $logo.Replace(
  'dark ? "text-zinc-950 dark:text-white" : "text-white"',
  'dark ? "text-zinc-950 dark:text-white" : "text-zinc-950 dark:text-white"'
)
[System.IO.File]::WriteAllText((Resolve-Path $logoPath), $logo, [System.Text.UTF8Encoding]::new($false))

$special = @("app\ui\AppSidebar.tsx","app\components\KlyxSelect.tsx")
foreach ($relative in $special) {
  if (-not (Test-Path -LiteralPath $relative)) { continue }
  $content = Get-Content -LiteralPath $relative -Raw
  $content = [regex]::Replace($content, "(?<!dark:)border-white/10", "border-border dark:border-white/10")
  foreach ($opacity in @("30","35","40","45","55","60","62","70")) {
    $content = [regex]::Replace($content, "(?<!dark:)text-white/$opacity", "text-muted-foreground dark:text-white/$opacity")
  }
  [System.IO.File]::WriteAllText((Resolve-Path $relative), $content, [System.Text.UTF8Encoding]::new($false))
}

$patch = @'

/* KLYX 12.9 - GLOBAL LIGHT MODE */
:root { color-scheme: light; }
.dark { color-scheme: dark; }

.klyx-app-shell,
.klyx-app-content {
  color: var(--foreground);
}

input,
textarea,
select {
  color: var(--foreground);
}

input::placeholder,
textarea::placeholder {
  color: var(--muted-foreground);
}

img,
svg {
  max-width: 100%;
}
'@

$globals = $globals.TrimEnd() + "`r`n" + $patch + "`r`n"
[System.IO.File]::WriteAllText((Resolve-Path $globalsPath), $globals, [System.Text.UTF8Encoding]::new($false))

Write-Host "[OK] $changed fichier(s) TSX migre(s)." -ForegroundColor Green
Write-Host "[OK] Logo noir en clair / blanc en sombre." -ForegroundColor Green
Write-Host "[OK] Sidebar + KlyxSelect adaptes au theme." -ForegroundColor Green
Write-Host ""
Write-Host "Aucune API, Supabase ou logique metier modifiee." -ForegroundColor Cyan
