$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.47 - NATURAL BUDGET" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

if ($content -match "KLYX_NATURAL_BUDGET_12_47") {
  Write-Host "[OK] 12.47 deja appliquee." -ForegroundColor Green
  exit 0
}

$marker = "function detectBudget("
$start = $content.IndexOf($marker)
if ($start -lt 0) { throw "detectBudget introuvable. Aucun remplacement force." }

$bodyStart = $content.IndexOf("{", $start)
if ($bodyStart -lt 0) { throw "Debut detectBudget introuvable." }

$block = @'

  // KLYX_NATURAL_BUDGET_12_47
  const normalizedBudgetText = normalizeText(text);

  const budgetPatterns = [
    /(?:budget|maximum|max|jusqu a|pas plus de)\s*(?:de|est|a|:)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)?/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)\s*(?:max|maximum)/i,
    /(?:pour|avec)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)/i,
  ];

  for (const pattern of budgetPatterns) {
    const match = normalizedBudgetText.match(pattern);
    if (!match) continue;

    const amount = Number(match[1].replace(",", "."));

    if (Number.isFinite(amount) && amount > 0 && amount <= 1000000) {
      return Math.round(amount * 100) / 100;
    }
  }
'@

$content = $content.Insert($bodyStart + 1, $block)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Budget naturel ajoute" -ForegroundColor Green
Write-Host "[OK] Expressions max / maximum supportees" -ForegroundColor Green
Write-Host "[OK] Euros / EUR supportes" -ForegroundColor Green
Write-Host "[OK] Detection existante conservee" -ForegroundColor Green
Write-Host ""
Write-Host "12.47 appliquee. Aucune migration SQL." -ForegroundColor Cyan
