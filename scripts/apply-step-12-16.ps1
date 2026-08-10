$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.16 - MOBILE + LIGHT/DARK FINAL" -ForegroundColor Cyan
Write-Host ""

# 1. KlyxSelect complet et theme-aware.
Copy-Item `
  -LiteralPath (Join-Path $payload "app\components\KlyxSelect.tsx") `
  -Destination "app\components\KlyxSelect.tsx" `
  -Force
Write-Host "[OK] KlyxSelect clair/sombre" -ForegroundColor Green

# 2. Derniere couche CSS canonique, idempotente.
$globalsPath = "app\globals.css"
$globals = Get-Content -LiteralPath $globalsPath -Raw
$marker = "/* KLYX 12.16 - CANONICAL MOBILE + LIGHT/DARK */"

if ($globals -notmatch [regex]::Escape($marker)) {
  $patch = Get-Content `
    -LiteralPath (Join-Path $payload "app\theme-12-16.css.txt") `
    -Raw

  $globals = $globals.TrimEnd() + "`r`n`r`n" + $patch + "`r`n"

  [IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $globalsPath),
    $globals,
    [Text.UTF8Encoding]::new($false)
  )

  Write-Host "[OK] globals.css couche 12.16" -ForegroundColor Green
}
else {
  Write-Host "[OK] globals.css deja en 12.16" -ForegroundColor Green
}

# 3. Sidebar : quelques classes encore sombres en clair.
$sidebarPath = "app\ui\AppSidebar.tsx"
$sidebar = Get-Content -LiteralPath $sidebarPath -Raw

$sidebar = $sidebar.Replace(
  'border border-border dark:border-white/10 bg-white/5 px-3 py-1.5',
  'border border-border bg-muted/60 px-3 py-1.5 dark:border-white/10 dark:bg-white/5'
)

$sidebar = $sidebar.Replace(
  'className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/7"',
  'className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted dark:hover:bg-white/7"'
)

$sidebar = $sidebar.Replace(
  '"bg-white/[0.045] group-hover:bg-white/8"',
  '"bg-muted group-hover:bg-muted/80 dark:bg-white/[0.045] dark:group-hover:bg-white/8"'
)

$sidebar = $sidebar.Replace(
  ': "text-violet-200 hover:bg-violet-500/10"',
  ': "text-violet-700 hover:bg-violet-500/10 dark:text-violet-200"'
)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $sidebarPath),
  $sidebar,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Sidebar clair/sombre" -ForegroundColor Green
Write-Host ""
Write-Host "12.16 appliquee. Aucune logique metier modifiee." -ForegroundColor Cyan
