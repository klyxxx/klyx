$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.31 - AI OFFER ADVISOR" -ForegroundColor Cyan
Write-Host ""

foreach ($relative in @(
  "app\api\brain\market-advice\[id]\route.ts",
  "app\assistant\market\[id]\page.tsx"
)) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Payload manquant : $relative"
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "[OK] $relative" -ForegroundColor Green
}

$requestsPath = "app\requests\page.tsx"
$requests = Get-Content -LiteralPath $requestsPath -Raw

if ($requests -notmatch 'Analyser avec KLYX') {
  $anchor = @'
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black">
                        Offres reçues ({item.offers.length})
                      </p>
'@

  if (-not $requests.Contains($anchor)) {
    throw "Bloc Offres recues introuvable."
  }

  $replacement = @'
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-black">
                          Offres reçues ({item.offers.length})
                        </p>

                        {item.offers.length > 0 && (
                          <Link
                            href={`/assistant/market/${item.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-700 hover:bg-violet-500/15 dark:text-violet-300"
                          >
                            Analyser avec KLYX
                          </Link>
                        )}
                      </div>
'@

  $requests = $requests.Replace(
    $anchor,
    $replacement
  )

  [IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $requestsPath),
    $requests,
    [Text.UTF8Encoding]::new($false)
  )
}

Write-Host "[OK] /requests -> conseiller KLYX" -ForegroundColor Green
Write-Host "[OK] Recommandation explicable" -ForegroundColor Green
Write-Host "[OK] Le client garde le choix final" -ForegroundColor Green
Write-Host ""
Write-Host "12.31 appliquee. Aucune migration SQL." -ForegroundColor Cyan
