$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.46 - NATURAL TIME" -ForegroundColor Cyan
Write-Host ""

$path = "app\api\brain\respond\route.ts"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

if ($content -match "KLYX_NATURAL_TIME_12_46") {
  Write-Host "[OK] 12.46 deja appliquee." -ForegroundColor Green
  exit 0
}

$marker = "function detectTime(text: string): string | null {"
$start = $content.IndexOf($marker)
if ($start -lt 0) { throw "detectTime introuvable." }

$insertMarker = "  const match = value.match("
$insertAt = $content.IndexOf($insertMarker, $start)
if ($insertAt -lt 0) { throw "Point insertion heure naturelle introuvable." }

$block = @'
  // KLYX_NATURAL_TIME_12_46
  const naturalTimes = [
    {
      expressions: ["midi", "a midi", "vers midi"],
      time: "12:00",
    },
    {
      expressions: ["minuit", "a minuit", "vers minuit"],
      time: "00:00",
    },
    {
      expressions: [
        "le matin",
        "dans la matinee",
        "en matinee",
        "matin",
      ],
      time: "09:00",
    },
    {
      expressions: [
        "l apres midi",
        "dans l apres midi",
        "apres midi",
      ],
      time: "14:00",
    },
    {
      expressions: [
        "le soir",
        "dans la soiree",
        "en soiree",
        "soir",
      ],
      time: "18:00",
    },
  ];

  for (const naturalTime of naturalTimes) {
    if (
      naturalTime.expressions.some((expression) =>
        approximatelyContains(value, expression)
      )
    ) {
      return naturalTime.time;
    }
  }

'@

$content = $content.Insert($insertAt, $block)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Midi + minuit compris" -ForegroundColor Green
Write-Host "[OK] Matin compris" -ForegroundColor Green
Write-Host "[OK] Apres-midi compris" -ForegroundColor Green
Write-Host "[OK] Soir compris" -ForegroundColor Green
Write-Host "[OK] Heures numeriques conservees" -ForegroundColor Green
Write-Host ""
Write-Host "12.46 appliquee. Aucune migration SQL." -ForegroundColor Cyan
