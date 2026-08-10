$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.15 - SERVICES DYNAMIQUES" -ForegroundColor Cyan

Copy-Item -LiteralPath (Join-Path $payload "lib\provider-search.ts") -Destination "lib\provider-search.ts" -Force
New-Item -ItemType Directory -Path "app\api\services\public" -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $payload "app\api\services\public\route.ts") -Destination "app\api\services\public\route.ts" -Force
Write-Host "[OK] lib/provider-search.ts" -ForegroundColor Green
Write-Host "[OK] app/api/services/public/route.ts" -ForegroundColor Green

$searchPath = "app\search\page.tsx"
$s = Get-Content -LiteralPath $searchPath -Raw

$s = $s.Replace("  SERVICE_OPTIONS,`r`n", "")
$s = $s.Replace("  SERVICE_OPTIONS,`n", "")
if ($s -notmatch 'DEFAULT_SERVICE_OPTIONS') {
  $s = $s.Replace("  formatProviderPrice,`r`n", "  DEFAULT_SERVICE_OPTIONS,`r`n  formatProviderPrice,`r`n")
  $s = $s.Replace("  formatProviderPrice,`n", "  DEFAULT_SERVICE_OPTIONS,`n  formatProviderPrice,`n")
}
if ($s -notmatch 'type PublicServiceOption') {
  $s = $s.Replace("  type ProviderSearchItem,`r`n", "  type PublicServiceOption,`r`n  type ProviderSearchItem,`r`n")
  $s = $s.Replace("  type ProviderSearchItem,`n", "  type PublicServiceOption,`n  type ProviderSearchItem,`n")
}

$stateAnchor = '  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);'
if ($s -notmatch 'serviceOptions, setServiceOptions') {
  $stateNew = @'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [serviceOptions, setServiceOptions] =
    useState<PublicServiceOption[]>(DEFAULT_SERVICE_OPTIONS);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServices() {
      try {
        const response = await fetch("/api/services/public", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          services?: PublicServiceOption[];
        };

        if (
          response.ok &&
          Array.isArray(body.services) &&
          body.services.length > 0
        ) {
          setServiceOptions(body.services);
        }
      } catch {
        // "Tous les services" reste disponible si le chargement échoue.
      }
    }

    void loadServices();
    return () => controller.abort();
  }, []);
'@
  if (-not $s.Contains($stateAnchor)) { throw "Ancre state search introuvable." }
  $s = $s.Replace($stateAnchor, $stateNew)
}

$s = $s.Replace("SERVICE_OPTIONS.map((option)", "serviceOptions.map((option)")
$s = $s.Replace("SERVICE_OPTIONS.find((service)", "serviceOptions.find((service)")

[IO.File]::WriteAllText((Resolve-Path -LiteralPath $searchPath), $s, [Text.UTF8Encoding]::new($false))
Write-Host "[OK] app/search/page.tsx" -ForegroundColor Green

$bookPath = "app\providers\[id]\book\page.tsx"
$b = Get-Content -LiteralPath $bookPath -Raw

$b = [regex]::Replace($b, '(?s)const SERVICE_LABELS: Record<string, string> = \{.*?\};\s*', '', 1)
$b = $b.Replace('const serviceSlug = searchParams.get("service")?.trim() || "babysitting";',
                'const serviceSlug = searchParams.get("service")?.trim() || "";')
$b = $b.Replace('.select("id, slug")', '.select("id, slug, name")')

if ($b -notmatch 'const \[serviceName, setServiceName\]') {
  $anchor = '  const [profile, setProfile] = useState<ProfileRow | null>(null);'
  $new = $anchor + "`r`n" + '  const [serviceName, setServiceName] = useState("Service KLYX");'
  if (-not $b.Contains($anchor)) { throw "Ancre state booking introuvable." }
  $b = $b.Replace($anchor, $new)
}

if ($b -notmatch 'Aucun service n.a été sélectionné') {
  $anchor = '      try {'
  $new = @'
      try {
        if (!serviceSlug) {
          throw new Error("Aucun service n’a été sélectionné.");
        }
'@
  $b = $b.Replace($anchor, $new)
}

$setAnchor = '        setProfile(profileData as ProfileRow);'
if ($b -notmatch 'setServiceName\(') {
  $setNew = @'
        setProfile(profileData as ProfileRow);
        setServiceName(
          typeof serviceResult.data.name === "string" &&
            serviceResult.data.name.trim()
            ? serviceResult.data.name.trim()
            : serviceResult.data.slug
        );
'@
  if (-not $b.Contains($setAnchor)) { throw "Ancre setProfile introuvable." }
  $b = $b.Replace($setAnchor, $setNew)
}

$b = [regex]::Replace($b, '\{SERVICE_LABELS\[serviceSlug\]\s*\|\|\s*serviceSlug\}', '{serviceName}')
$b = [regex]::Replace($b, '\{SERVICE_LABELS\[serviceSlug\]\s*\|\|\s*"Service KLYX"\}', '{serviceName}')

[IO.File]::WriteAllText((Resolve-Path -LiteralPath $bookPath), $b, [Text.UTF8Encoding]::new($false))
Write-Host "[OK] app/providers/[id]/book/page.tsx" -ForegroundColor Green

$apiPath = "app\api\search\providers\route.ts"
$a = Get-Content -LiteralPath $apiPath -Raw
if ($a -notmatch '"rating_desc"') {
  $a = $a.Replace('  "score_desc",', "  `"score_desc`",`r`n  `"rating_desc`",")
  [IO.File]::WriteAllText((Resolve-Path -LiteralPath $apiPath), $a, [Text.UTF8Encoding]::new($false))
}
Write-Host "[OK] app/api/search/providers/route.ts" -ForegroundColor Green
Write-Host ""
Write-Host "12.15 appliquee. Aucune migration SQL." -ForegroundColor Cyan
