$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.45 - NATURAL DATES" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

if ($content -match "KLYX_WEEKDAY_12_45") {
  Write-Host "[OK] 12.45 deja appliquee." -ForegroundColor Green
  exit 0
}

$marker = "function detectDate(text: string): string | null {"
$start = $content.IndexOf($marker)
if ($start -lt 0) { throw "detectDate introuvable." }

$numericMarker = "  const numericMatch = text.match("
$insertAt = $content.IndexOf($numericMarker, $start)
if ($insertAt -lt 0) { throw "Point insertion date naturelle introuvable." }

$block = @'
  // KLYX_WEEKDAY_12_45
  const weekdayRules = [
    { day: 1, aliases: ["lundi"] },
    { day: 2, aliases: ["mardi"] },
    { day: 3, aliases: ["mercredi"] },
    { day: 4, aliases: ["jeudi"] },
    { day: 5, aliases: ["vendredi"] },
    { day: 6, aliases: ["samedi"] },
    { day: 0, aliases: ["dimanche"] },
  ];

  for (const rule of weekdayRules) {
    if (
      rule.aliases.some((alias) =>
        approximatelyContains(value, alias)
      )
    ) {
      const date = new Date(now);
      const currentDay = date.getDay();
      let daysAhead = (rule.day - currentDay + 7) % 7;

      if (daysAhead === 0) {
        daysAhead = 7;
      }

      date.setDate(date.getDate() + daysAhead);
      return toLocalIsoDate(date);
    }
  }

'@

$content = $content.Insert($insertAt, $block)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Lundi a dimanche compris" -ForegroundColor Green
Write-Host "[OK] Prochain jour correspondant calcule" -ForegroundColor Green
Write-Host "[OK] Demain / apres-demain conserves" -ForegroundColor Green
Write-Host "[OK] Dates numeriques conservees" -ForegroundColor Green
Write-Host ""
Write-Host "12.45 appliquee. Aucune migration SQL." -ForegroundColor Cyan
