$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.30 - AI MARKET ASSISTANT" -ForegroundColor Cyan
Write-Host ""

foreach ($relative in @(
  "app\assistant\market\page.tsx",
  "app\api\brain\market-publish\route.ts"
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

if ($requests -notmatch 'href="/assistant/market"') {
  $anchor = '<h2 className="text-2xl font-black">' + "`r`n" + '            Nouvelle demande ouverte' + "`r`n" + '          </h2>'

  if (-not $requests.Contains($anchor)) {
    $anchor = '<h2 className="text-2xl font-black">' + "`n" + '            Nouvelle demande ouverte' + "`n" + '          </h2>'
  }

  if (-not $requests.Contains($anchor)) {
    throw "Titre Nouvelle demande ouverte introuvable."
  }

  $replacement = $anchor + @'

          <Link
            href="/assistant/market"
            className="klyx-button-secondary mt-4 w-full sm:w-auto"
          >
            Préparer avec KLYX Assistant
          </Link>
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

Write-Host "[OK] /requests -> assistant" -ForegroundColor Green
Write-Host "[OK] Confirmation explicite avant publication" -ForegroundColor Green
Write-Host ""
Write-Host "12.30 appliquee. Aucune migration SQL." -ForegroundColor Cyan
