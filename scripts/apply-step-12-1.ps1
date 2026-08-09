$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Replace-Exact {
  param([string]$Path,[string]$Old,[string]$New)
  $full = Join-Path $root $Path
  $content = Get-Content -LiteralPath $full -Raw
  if (-not $content.Contains($Old)) {
    throw "Point d'insertion introuvable : $Path"
  }
  $content = $content.Replace($Old,$New)
  Set-Content -LiteralPath $full -Value $content -Encoding utf8
  Write-Host "[OK] $Path" -ForegroundColor Green
}

Write-Host ""
Write-Host "KLYX 12.1 - UX SERVICES / MOBILE / SEARCH" -ForegroundColor Cyan
Write-Host ""

# Tous les metiers dans le Studio
$path = "app\api\provider\studio\route.ts"
$full = Join-Path $root $path
$c = Get-Content -LiteralPath $full -Raw

$c = $c.Replace('const INITIAL_SERVICE_SLUGS = [
  "babysitting",
  "cleaning",
  "moving",
  "handyman",
];

','')

$c = $c.Replace('.from("services")
      .select("id, name, slug")
      .in("slug", INITIAL_SERVICE_SLUGS)
      .order("name", { ascending: true })',
'.from("services")
      .select("id, name, slug")
      .order("name", { ascending: true })')

$c = $c.Replace('.from("services")
        .select("id, slug")
        .in("slug", INITIAL_SERVICE_SLUGS),',
'.from("services")
        .select("id, slug"),')

$c = $c.Replace('  pricing_type: string | null;
  price: number | null;',
'  pricing_type: string | null;
  price: number | null;
  hourly_price: number | null;
  fixed_price: number | null;')

$c = $c.Replace('"id, user_service_id, title, description, pricing_type, price, city, service_area, travel_radius_km, available"',
'"id, user_service_id, title, description, pricing_type, price, hourly_price, fixed_price, city, service_area, travel_radius_km, available"')

$c = $c.Replace('  price?: unknown;
  city?: unknown;',
'  price?: unknown;
  hourlyPrice?: unknown;
  fixedPrice?: unknown;
  city?: unknown;')

$c = $c.Replace('  price: number | null;
  city: string;',
'  price: number | null;
  hourlyPrice: number | null;
  fixedPrice: number | null;
  city: string;')

$c = $c.Replace('      price:
        serviceProfile?.price === null || serviceProfile?.price === undefined
          ? null
          : Number(serviceProfile.price),',
'      price:
        serviceProfile?.price === null || serviceProfile?.price === undefined
          ? null
          : Number(serviceProfile.price),
      hourlyPrice:
        serviceProfile?.hourly_price === null ||
        serviceProfile?.hourly_price === undefined
          ? serviceProfile?.pricing_type === "hourly" &&
            serviceProfile?.price !== null &&
            serviceProfile?.price !== undefined
            ? Number(serviceProfile.price)
            : null
          : Number(serviceProfile.hourly_price),
      fixedPrice:
        serviceProfile?.fixed_price === null ||
        serviceProfile?.fixed_price === undefined
          ? serviceProfile?.pricing_type === "fixed" &&
            serviceProfile?.price !== null &&
            serviceProfile?.price !== undefined
            ? Number(serviceProfile.price)
            : null
          : Number(serviceProfile.fixed_price),')

$c = $c.Replace('    const priceValue =
      item.price === null || item.price === "" ? null : Number(item.price);
    const city = cleanText(item.city, 100);',
'    const priceValue =
      item.price === null || item.price === "" ? null : Number(item.price);
    const hourlyPrice =
      item.hourlyPrice === null || item.hourlyPrice === ""
        ? pricingType === "hourly"
          ? priceValue
          : null
        : Number(item.hourlyPrice);
    const fixedPrice =
      item.fixedPrice === null || item.fixedPrice === ""
        ? pricingType === "fixed"
          ? priceValue
          : null
        : Number(item.fixedPrice);
    const city = cleanText(item.city, 100);')

$c = $c.Replace('      price: priceValue,
      city,',
'      price: pricingType === "fixed" ? fixedPrice : hourlyPrice,
      hourlyPrice,
      fixedPrice,
      city,')

$c = $c.Replace('        pricing_type: service.pricingType,
        price: service.price,',
'        pricing_type: service.pricingType,
        price: service.price,
        hourly_price: service.hourlyPrice,
        fixed_price: service.fixedPrice,')

Set-Content -LiteralPath $full -Value $c -Encoding utf8
Write-Host "[OK] $path" -ForegroundColor Green

# Types Studio
Replace-Exact "lib\provider-studio.ts" `
'  pricingType: PricingType;
  price: number | null;
  city: string;' `
'  pricingType: PricingType;
  price: number | null;
  hourlyPrice: number | null;
  fixedPrice: number | null;
  city: string;'

# Upload image/document ne doit pas ecraser le brouillon
Replace-Exact "app\components\ProviderStudio.tsx" `
'    const data = await readApiResponse(response);
    applyStudioData(data);' `
'    const data = await readApiResponse(response);

    setStudio((current) =>
      current
        ? {
            ...current,
            profile: data.profile,
            providerProfile: data.providerProfile,
            gallery: data.gallery,
            documents: data.documents,
          }
        : data
    );'

# Anti debordement Studio
$p = Join-Path $root "app\components\ProviderStudio.tsx"
$s = Get-Content -LiteralPath $p -Raw
$s = $s.Replace('className="mx-auto max-w-7xl"','className="mx-auto min-w-0 max-w-7xl overflow-x-hidden"')
Set-Content -LiteralPath $p -Value $s -Encoding utf8

# Search API : tous les services + debut/fin
$p = Join-Path $root "app\api\search\providers\route.ts"
$s = Get-Content -LiteralPath $p -Raw
$s = $s.Replace('const SERVICE_SLUGS = ["babysitting", "cleaning", "moving", "handyman"];
','')
$s = $s.Replace('  time: string;
  durationHours: number;',
'  startTime: string;
  endTime: string;')
$s = $s.Replace('  const requestedTime = cleanText(params.get("time"), 5);
  const duration = numberParam(params.get("duration"), 1, 12);',
'  const legacyTime = cleanText(params.get("time"), 5);
  const requestedStart = cleanText(params.get("start") ?? (legacyTime || null), 5);
  const requestedEnd = cleanText(params.get("end"), 5);
  const legacyDuration = numberParam(params.get("duration"), 1, 12);
  const startMinutes = timeToMinutes(requestedStart);
  const legacyEnd =
    startMinutes !== null && legacyDuration !== null
      ? (() => {
          const total = startMinutes + legacyDuration * 60;
          const hours = Math.floor(total / 60);
          const minutes = total % 60;
          return hours <= 23
            ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
            : "";
        })()
      : "";')
$s = $s.Replace('    serviceSlug: SERVICE_SLUGS.includes(requestedService)
      ? requestedService
      : "all",',
'    serviceSlug: requestedService || "all",')
$s = $s.Replace('    time: timeToMinutes(requestedTime) === null ? "" : requestedTime,
    durationHours: duration ?? 1,',
'    startTime: startMinutes === null ? "" : requestedStart,
    endTime:
      timeToMinutes(requestedEnd) !== null
        ? requestedEnd
        : legacyEnd,')
$s = $s.Replace('  if (!filters.date && !filters.time) return true;',
'  if (!filters.date && !filters.startTime && !filters.endTime) return true;')
$s = $s.Replace('  const requestedStart = filters.time ? timeToMinutes(filters.time) : null;
  const requestedEnd =
    requestedStart === null
      ? null
      : requestedStart + filters.durationHours * 60;',
'  const requestedStart = filters.startTime
    ? timeToMinutes(filters.startTime)
    : null;
  const requestedEnd = filters.endTime
    ? timeToMinutes(filters.endTime)
    : null;')
$s = $s.Replace('  let servicesQuery = supabaseAdmin
    .from("services")
    .select("id, name, slug")
    .in("slug", SERVICE_SLUGS);',
'  let servicesQuery = supabaseAdmin
    .from("services")
    .select("id, name, slug");')
$s = $s.Replace('        filters.time ||','        filters.startTime ||
        filters.endTime ||')
Set-Content -LiteralPath $p -Value $s -Encoding utf8
Write-Host "[OK] app\api\search\providers\route.ts" -ForegroundColor Green

# Search page
$p = Join-Path $root "app\search\page.tsx"
$s = Get-Content -LiteralPath $p -Raw
$s = $s.Replace('  time: string;
  duration: string;',
'  startTime: string;
  endTime: string;')
$s = $s.Replace('    time: params.get("time")?.trim() || "",
    duration: params.get("duration")?.trim() || "1",',
'    startTime:
      params.get("start")?.trim() ||
      params.get("time")?.trim() ||
      "",
    endTime: params.get("end")?.trim() || "",')
$s = $s.Replace('  if (filters.time) {
    params.set("time", filters.time);
    params.set("duration", filters.duration || "1");
  }',
'  if (filters.startTime) params.set("start", filters.startTime);
  if (filters.endTime) params.set("end", filters.endTime);')
$s = $s.Replace('      appliedFilters.time ||','      appliedFilters.startTime ||
      appliedFilters.endTime ||')
$s = $s.Replace('    if (draft.time) {
      params.set("time", draft.time);
      params.set("duration", draft.duration || "1");
    }',
'    if (draft.startTime) params.set("start", draft.startTime);
    if (draft.endTime) params.set("end", draft.endTime);')

$old = @'
            <FilterField label="Heure souhaitée" icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.time}
                onChange={(event) => updateDraft("time", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Durée" icon={<Clock3 size={17} />}>
              <KlyxSelect
                value={draft.duration}
                disabled={!draft.time}
                onChange={(value) => updateDraft("duration", value)}
                options={[1, 2, 3, 4, 6, 8].map((hours) => ({
                  value: String(hours),
                  label: `${hours} heure${hours > 1 ? "s" : ""}`,
                }))}
                ariaLabel="Durée"
              />
            </FilterField>
'@
$new = @'
            <FilterField label="Heure de début" icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.startTime}
                onChange={(event) => updateDraft("startTime", event.target.value)}
                className="filter-control"
              />
            </FilterField>

            <FilterField label="Heure de fin" icon={<Clock3 size={17} />}>
              <input
                type="time"
                value={draft.endTime}
                min={draft.startTime || undefined}
                onChange={(event) => updateDraft("endTime", event.target.value)}
                className="filter-control"
              />
            </FilterField>
'@
if (-not $s.Contains($old)) { throw "Bloc heure/duree introuvable : app\search\page.tsx" }
$s = $s.Replace($old,$new)
$s = $s.Replace('className="min-h-screen bg-zinc-950 px-5 py-10 text-white"',
'className="min-h-screen overflow-x-hidden bg-zinc-950 px-3 py-5 text-white sm:px-5 sm:py-8"')
Set-Content -LiteralPath $p -Value $s -Encoding utf8
Write-Host "[OK] app\search\page.tsx" -ForegroundColor Green

# CSS mobile anti overflow
$cssPath = Join-Path $root "app\globals.css"
$css = Get-Content -LiteralPath $cssPath -Raw
if (-not $css.Contains("/* KLYX 12.1 - mobile forms */")) {
@'

/* KLYX 12.1 - mobile forms */
.klyx-page,
.klyx-card,
form,
fieldset,
label {
  min-width: 0;
}

.klyx-input,
.filter-control,
input,
textarea,
select {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.filter-control {
  width: 100%;
}

@media (max-width: 640px) {
  .klyx-page {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  input,
  textarea,
  select,
  button {
    font-size: 16px;
  }
}
'@ | Add-Content -LiteralPath $cssPath -Encoding utf8
}
Write-Host "[OK] app\globals.css" -ForegroundColor Green

Write-Host ""
Write-Host "PATCH 12.1 APPLIQUE." -ForegroundColor Green
Write-Host "Execute maintenant le SQL Supabase puis npm run build." -ForegroundColor Yellow
