$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packageRoot = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $packageRoot "payload"

Set-Location $root

Write-Host ""
Write-Host "KLYX 12.13 - AVIS PUBLICS VERIFIES" -ForegroundColor Cyan
Write-Host ""

$copyFiles = @(
  "app\api\providers\[id]\reviews\route.ts",
  "app\providers\[id]\PublicReviews.tsx"
)

foreach ($relative in $copyFiles) {
  $source = Join-Path $payload $relative
  $target = Join-Path $root $relative
  $directory = Split-Path -Parent $target

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Source manquante : $source"
  }

  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force

  Write-Host "[OK] $relative" -ForegroundColor Green
}

$pagePath = "app\providers\[id]\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath)) {
  throw "$pagePath introuvable."
}

$page = Get-Content -LiteralPath $pagePath -Raw

$importLine =
  'import PublicReviews from "./PublicReviews";'

if ($page -notmatch [regex]::Escape($importLine)) {
  $anchor =
    'import { formatServicePrice, serviceLabel, type PricingType } from "@/lib/provider-studio";'

  if (-not $page.Contains($anchor)) {
    throw "Import provider-studio introuvable."
  }

  $page = $page.Replace(
    $anchor,
    "$anchor`r`n$importLine"
  )
}

$renderLine =
  '        <PublicReviews providerId={profile.id} />'

if ($page -notmatch [regex]::Escape($renderLine)) {
  $anchor = @'
        </section>
      </div>
    </main>
  );
}
'@

  $replacement = @'
        </section>

        <PublicReviews providerId={profile.id} />
      </div>
    </main>
  );
}
'@

  $lastIndex = $page.LastIndexOf($anchor)

  if ($lastIndex -lt 0) {
    throw "Fin de page provider introuvable."
  }

  $page =
    $page.Substring(0, $lastIndex) +
    $replacement +
    $page.Substring(
      $lastIndex + $anchor.Length
    )
}

[System.IO.File]::WriteAllText(
  (Resolve-Path $pagePath),
  $page,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Bloc avis ajoute au profil public" -ForegroundColor Green
Write-Host ""
Write-Host "12.13 appliquee. Aucune migration SQL." -ForegroundColor Cyan
