$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.22 - RESERVATION DIRECTE + DEVIS" -ForegroundColor Cyan

$source = Join-Path $payload "app\providers\[id]\quote\page.tsx"
$target = Join-Path $root "app\providers\[id]\quote\page.tsx"

if (-not (Test-Path -LiteralPath $source)) { throw "Payload page devis manquant." }
New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host "[OK] /providers/[id]/quote" -ForegroundColor Green

$profilePath = "app\providers\[id]\page.tsx"
$content = Get-Content -LiteralPath $profilePath -Raw

if ($content -notmatch 'Demander un devis') {
  $old = @'
                    <Link
                      href={`/providers/${profile.id}/book?service=${encodeURIComponent(
                        service.slug
                      )}`}
                      className="rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200"
                    >
                      Réserver
                    </Link>
'@

  $new = @'
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/providers/${profile.id}/quote?service=${encodeURIComponent(
                          service.slug
                        )}`}
                        className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-3 font-semibold text-violet-700 hover:bg-violet-500/15 dark:text-violet-200"
                      >
                        Demander un devis
                      </Link>

                      <Link
                        href={`/providers/${profile.id}/book?service=${encodeURIComponent(
                          service.slug
                        )}`}
                        className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
                      >
                        Réserver directement
                      </Link>
                    </div>
'@

  if (-not $content.Contains($old)) {
    throw "CTA Réserver du profil prestataire introuvable."
  }

  $content = $content.Replace($old, $new)
  [IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $profilePath),
    $content,
    [Text.UTF8Encoding]::new($false)
  )
}

Write-Host "[OK] Profil : devis OU reservation directe" -ForegroundColor Green
Write-Host ""
Write-Host "12.22 appliquee. Aucune migration SQL." -ForegroundColor Cyan
