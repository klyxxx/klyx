$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiDir = Join-Path `
    $projectRoot `
    "app\api\profile\phone\access-history"

$apiPath = Join-Path `
    $apiDir `
    "route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\settings\PhoneAccessHistory.tsx"

$settingsPath = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

Write-Host ""
Write-Host "KLYX 12.76 - Phone Privacy History"
Write-Host ""

if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw "app/settings/page.tsx introuvable."
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $apiDir |
    Out-Null

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

# ============================================================
# API ACCESS HISTORY
# ============================================================

$apiLines = @(
'import { NextResponse } from "next/server";'
''
'import {'
'  apiErrorStatus,'
'  getAuthenticatedProfile,'
'} from "@/lib/api-auth";'
'import { supabaseAdmin } from "@/lib/supabase-admin";'
''
'// KLYX_PHONE_ACCESS_HISTORY_API_12_76'
''
'type AccessLogRow = {'
'  id: string;'
'  booking_id: string;'
'  viewer_profile_id: string;'
'  contact_profile_id: string;'
'  event_type: string;'
'  created_at: string;'
'};'
''
'type ProfileRow = {'
'  id: string;'
'  first_name: string | null;'
'  last_name: string | null;'
'};'
''
'type BookingRow = {'
'  id: string;'
'  status: string;'
'  service_id: string | null;'
'};'
''
'type ServiceRow = {'
'  id: string;'
'  slug: string;'
'};'
''
'function displayName('
'  profile: ProfileRow | undefined'
') {'
'  if (!profile) {'
'    return "Utilisateur KLYX";'
'  }'
''
'  return ('
'    [profile.first_name, profile.last_name]'
'      .filter(Boolean)'
'      .join(" ") ||'
'    "Utilisateur KLYX"'
'  );'
'}'
''
'function eventLabel(eventType: string) {'
'  if (eventType === "phone_explicit_reveal") {'
'    return "Numero affiche";'
'  }'
''
'  if (eventType === "phone_call_started") {'
'    return "Appel lance";'
'  }'
''
'  if (eventType === "phone_reveal") {'
'    return "Numero consulte";'
'  }'
''
'  return "Acces telephone";'
'}'
''
'export async function GET(request: Request) {'
'  try {'
'    const { profile } ='
'      await getAuthenticatedProfile(request);'
''
'    const {'
'      data: logsData,'
'      error: logsError,'
'    } = await supabaseAdmin'
'      .from("phone_contact_access_logs")'
'      .select('
'        "id, booking_id, viewer_profile_id, contact_profile_id, event_type, created_at"'
'      )'
'      .eq("contact_profile_id", profile.id)'
'      .order("created_at", {'
'        ascending: false,'
'      })'
'      .limit(30);'
''
'    if (logsError) {'
'      throw new Error(logsError.message);'
'    }'
''
'    const logs ='
'      (logsData ?? []) as AccessLogRow[];'
''
'    if (logs.length === 0) {'
'      return NextResponse.json({'
'        items: [],'
'        total: 0,'
'      });'
'    }'
''
'    const viewerIds = Array.from('
'      new Set('
'        logs.map('
'          (item) => item.viewer_profile_id'
'        )'
'      )'
'    );'
''
'    const bookingIds = Array.from('
'      new Set('
'        logs.map('
'          (item) => item.booking_id'
'        )'
'      )'
'    );'
''
'    const [profilesResult, bookingsResult] ='
'      await Promise.all(['
'        supabaseAdmin'
'          .from("profiles")'
'          .select('
'            "id, first_name, last_name"'
'          )'
'          .in("id", viewerIds),'
''
'        supabaseAdmin'
'          .from("bookings")'
'          .select('
'            "id, status, service_id"'
'          )'
'          .in("id", bookingIds),'
'      ]);'
''
'    if (profilesResult.error) {'
'      throw new Error('
'        profilesResult.error.message'
'      );'
'    }'
''
'    if (bookingsResult.error) {'
'      throw new Error('
'        bookingsResult.error.message'
'      );'
'    }'
''
'    const profiles ='
'      (profilesResult.data ?? []) as ProfileRow[];'
''
'    const bookings ='
'      (bookingsResult.data ?? []) as BookingRow[];'
''
'    const serviceIds = Array.from('
'      new Set('
'        bookings'
'          .map((item) => item.service_id)'
'          .filter('
'            (value): value is string =>'
'              Boolean(value)'
'          )'
'      )'
'    );'
''
'    let services: ServiceRow[] = [];'
''
'    if (serviceIds.length > 0) {'
'      const {'
'        data: servicesData,'
'        error: servicesError,'
'      } = await supabaseAdmin'
'        .from("services")'
'        .select("id, slug")'
'        .in("id", serviceIds);'
''
'      if (servicesError) {'
'        throw new Error('
'          servicesError.message'
'        );'
'      }'
''
'      services ='
'        (servicesData ?? []) as ServiceRow[];'
'    }'
''
'    const profileMap = new Map('
'      profiles.map('
'        (item) => [item.id, item]'
'      )'
'    );'
''
'    const bookingMap = new Map('
'      bookings.map('
'        (item) => [item.id, item]'
'      )'
'    );'
''
'    const serviceMap = new Map('
'      services.map('
'        (item) => [item.id, item]'
'      )'
'    );'
''
'    const items = logs.map((log) => {'
'      const viewer ='
'        profileMap.get('
'          log.viewer_profile_id'
'        );'
''
'      const booking ='
'        bookingMap.get(log.booking_id);'
''
'      const service ='
'        booking?.service_id'
'          ? serviceMap.get('
'              booking.service_id'
'            )'
'          : undefined;'
''
'      return {'
'        id: log.id,'
'        bookingId: log.booking_id,'
'        viewerName:'
'          displayName(viewer),'
'        eventType: log.event_type,'
'        eventLabel:'
'          eventLabel(log.event_type),'
'        createdAt: log.created_at,'
'        bookingStatus:'
'          booking?.status ?? null,'
'        serviceSlug:'
'          service?.slug ?? null,'
'      };'
'    });'
''
'    return NextResponse.json({'
'      items,'
'      total: items.length,'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Historique telephone indisponible.";'
''
'    return NextResponse.json('
'      { error: message },'
'      { status: apiErrorStatus(message) }'
'    );'
'  }'
'}'
)

$apiContent =
    [string]::Join(
        "`n",
        $apiLines
    )

# ============================================================
# UI HISTORY
# ============================================================

$componentLines = @(
'"use client";'
''
'import {'
'  useCallback,'
'  useEffect,'
'  useState,'
'} from "react";'
'import {'
'  Eye,'
'  History,'
'  LoaderCircle,'
'  PhoneCall,'
'  RefreshCw,'
'  ShieldCheck,'
'} from "lucide-react";'
''
'import { supabase } from "@/lib/supabase";'
''
'// KLYX_PHONE_ACCESS_HISTORY_UI_12_76'
''
'type AccessItem = {'
'  id: string;'
'  bookingId: string;'
'  viewerName: string;'
'  eventType: string;'
'  eventLabel: string;'
'  createdAt: string;'
'  bookingStatus: string | null;'
'  serviceSlug: string | null;'
'};'
''
'type HistoryPayload = {'
'  items?: AccessItem[];'
'  total?: number;'
'  error?: string;'
'};'
''
'const SERVICE_LABELS: Record<string, string> = {'
'  babysitting: "Baby-sitting",'
'  cleaning: "Menage",'
'  moving: "Demenagement",'
'  handyman: "Bricolage",'
'};'
''
'function formatDate(value: string) {'
'  return new Intl.DateTimeFormat('
'    "fr-BE",'
'    {'
'      day: "2-digit",'
'      month: "2-digit",'
'      year: "numeric",'
'      hour: "2-digit",'
'      minute: "2-digit",'
'    }'
'  ).format(new Date(value));'
'}'
''
'function serviceLabel('
'  slug: string | null'
') {'
'  if (!slug) {'
'    return "Mission KLYX";'
'  }'
''
'  return SERVICE_LABELS[slug] ?? slug;'
'}'
''
'export default function PhoneAccessHistory() {'
'  const [items, setItems] ='
'    useState<AccessItem[]>([]);'
''
'  const [loading, setLoading] ='
'    useState(true);'
''
'  const [refreshing, setRefreshing] ='
'    useState(false);'
''
'  const [errorMessage, setErrorMessage] ='
'    useState("");'
''
'  const loadHistory ='
'    useCallback(async (refresh = false) => {'
'      if (refresh) {'
'        setRefreshing(true);'
'      } else {'
'        setLoading(true);'
'      }'
''
'      setErrorMessage("");'
''
'      try {'
'        const { data } ='
'          await supabase.auth.getSession();'
''
'        const token ='
'          data.session?.access_token;'
''
'        if (!token) {'
'          throw new Error('
'            "Session KLYX introuvable."'
'          );'
'        }'
''
'        const response = await fetch('
'          "/api/profile/phone/access-history",'
'          {'
'            cache: "no-store",'
'            headers: {'
'              Authorization:'
'                "Bearer " + token,'
'            },'
'          }'
'        );'
''
'        const result ='
'          (await response.json()) as HistoryPayload;'
''
'        if (!response.ok) {'
'          throw new Error('
'            result.error ||'
'              "Historique indisponible."'
'          );'
'        }'
''
'        setItems(result.items ?? []);'
'      } catch (error) {'
'        setErrorMessage('
'          error instanceof Error'
'            ? error.message'
'            : "Historique indisponible."'
'        );'
'      } finally {'
'        setLoading(false);'
'        setRefreshing(false);'
'      }'
'    }, []);'
''
'  useEffect(() => {'
'    void loadHistory();'
'  }, [loadHistory]);'
''
'  return ('
'    <section className="mb-7 rounded-[30px] border border-border bg-card p-6 sm:p-7">'
'      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">'
'        <div className="flex items-start gap-4">'
'          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-500">'
'            <History size={22} />'
'          </div>'
''
'          <div>'
'            <h2 className="text-xl font-black">'
'              Historique de confidentialite'
'            </h2>'
''
'            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">'
'              Consulte les derniers acces autorises a ton numero de telephone KLYX.'
'            </p>'
'          </div>'
'        </div>'
''
'        <button'
'          type="button"'
'          disabled={refreshing}'
'          onClick={() =>'
'            void loadHistory(true)'
'          }'
'          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted disabled:opacity-60"'
'        >'
'          <RefreshCw'
'            size={16}'
'            className={'
'              refreshing'
'                ? "animate-spin"'
'                : ""'
'            }'
'          />'
'          Actualiser'
'        </button>'
'      </div>'
''
'      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-500/[0.07] px-4 py-3">'
'        <ShieldCheck'
'          size={18}'
'          className="mt-0.5 shrink-0 text-emerald-500"'
'        />'
''
'        <p className="text-xs leading-5 text-muted-foreground">'
'          Cet historique affiche les acces de securite uniquement. Aucun numero de telephone ni code SMS OTP n y apparait.'
'        </p>'
'      </div>'
''
'      {loading ? ('
'        <div className="mt-6 flex items-center gap-3 text-sm font-bold text-muted-foreground">'
'          <LoaderCircle'
'            size={18}'
'            className="animate-spin"'
'          />'
'          Chargement de l historique...'
'        </div>'
'      ) : errorMessage ? ('
'        <div className="mt-6 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">'
'          {errorMessage}'
'        </div>'
'      ) : items.length === 0 ? ('
'        <div className="mt-6 rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">'
'          <ShieldCheck'
'            size={28}'
'            className="mx-auto text-emerald-500"'
'          />'
''
'          <p className="mt-3 font-black">'
'            Aucun acces enregistre'
'          </p>'
''
'          <p className="mt-1 text-sm text-muted-foreground">'
'            Personne n a encore revele ton numero via KLYX.'
'          </p>'
'        </div>'
'      ) : ('
'        <div className="mt-6 space-y-3">'
'          {items.map((item) => ('
'            <div'
'              key={item.id}'
'              className="flex min-w-0 items-start gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:p-5"'
'            >'
'              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500">'
'                {item.eventType ==='
'                "phone_call_started" ? ('
'                  <PhoneCall size={18} />'
'                ) : ('
'                  <Eye size={18} />'
'                )}'
'              </div>'
''
'              <div className="min-w-0 flex-1">'
'                <div className="flex flex-wrap items-center justify-between gap-2">'
'                  <p className="font-black">'
'                    {item.viewerName}'
'                  </p>'
''
'                  <span className="text-xs font-semibold text-muted-foreground">'
'                    {formatDate('
'                      item.createdAt'
'                    )}'
'                  </span>'
'                </div>'
''
'                <p className="mt-1 text-sm font-semibold">'
'                  {item.eventLabel}'
'                </p>'
''
'                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">'
'                  <span className="rounded-full bg-muted px-2.5 py-1">'
'                    {serviceLabel('
'                      item.serviceSlug'
'                    )}'
'                  </span>'
''
'                  {item.bookingStatus && ('
'                    <span className="rounded-full bg-muted px-2.5 py-1">'
'                      {item.bookingStatus}'
'                    </span>'
'                  )}'
''
'                  <span className="rounded-full bg-muted px-2.5 py-1">'
'                    Mission{" "}'
'                    {item.bookingId.slice('
'                      0,'
'                      8'
'                    )}'
'                  </span>'
'                </div>'
'              </div>'
'            </div>'
'          ))}'
'        </div>'
'      )}'
'    </section>'
'  );'
'}'
)

$componentContent =
    [string]::Join(
        "`n",
        $componentLines
    )

# ============================================================
# PATCH SETTINGS
# ============================================================

$settings =
    [System.IO.File]::ReadAllText(
        $settingsPath
    )

$historyImport =
    'import PhoneAccessHistory from "./PhoneAccessHistory";'

if (-not $settings.Contains(
    $historyImport
)) {
    $privacyImport =
        'import PhonePrivacyControls from "./PhonePrivacyControls";'

    $phoneImport =
        'import PhoneSettingsInline from "./PhoneSettingsInline";'

    if ($settings.Contains(
        $privacyImport
    )) {
        $settings =
            $settings.Replace(
                $privacyImport,
                $privacyImport +
                "`n" +
                $historyImport
            )
    }
    elseif ($settings.Contains(
        $phoneImport
    )) {
        $settings =
            $settings.Replace(
                $phoneImport,
                $phoneImport +
                "`n" +
                $historyImport
            )
    }
    else {
        throw "Ancre import telephone introuvable."
    }
}

$marker =
    "KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76"

if (-not $settings.Contains($marker)) {
    $privacyRender =
        "<PhonePrivacyControls />"

    $phoneRender =
        "<PhoneSettingsInline />"

    $anchor = $null

    if ($settings.Contains(
        $privacyRender
    )) {
        $anchor = $privacyRender
    }
    elseif ($settings.Contains(
        $phoneRender
    )) {
        $anchor = $phoneRender
    }
    else {
        throw "Bloc telephone Settings introuvable."
    }

    $anchorIndex =
        $settings.IndexOf($anchor)

    if ($anchorIndex -lt 0) {
        throw "Index ancre Settings introuvable."
    }

    $lineStart =
        $settings.LastIndexOf(
            "`n",
            $anchorIndex
        )

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart += 1
    }

    $indentLength =
        $anchorIndex - $lineStart

    $indent = ""

    if ($indentLength -gt 0) {
        $indent =
            $settings.Substring(
                $lineStart,
                $indentLength
            )
    }

    $insertIndex =
        $anchorIndex +
        $anchor.Length

    $historyBlockLines = @(
        ""
        ($indent + "{/* KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76 */}")
        ($indent + "<PhoneAccessHistory />")
    )

    $historyBlock =
        [string]::Join(
            "`n",
            $historyBlockLines
        )

    $settings =
        $settings.Substring(
            0,
            $insertIndex
        ) +
        $historyBlock +
        $settings.Substring(
            $insertIndex
        )
}

# ============================================================
# VALIDATION
# ============================================================

$checks = @(
    @{
        Name = "history API"
        Value = $apiContent.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_API_12_76"
        )
    },
    @{
        Name = "own history only"
        Value = $apiContent.Contains(
            '.eq("contact_profile_id", profile.id)'
        )
    },
    @{
        Name = "max 30"
        Value = $apiContent.Contains(
            ".limit(30)"
        )
    },
    @{
        Name = "no phone field query"
        Value = -not $apiContent.Contains(
            "phone_number"
        )
    },
    @{
        Name = "history UI"
        Value = $componentContent.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_UI_12_76"
        )
    },
    @{
        Name = "settings marker"
        Value = $settings.Contains(
            "KLYX_PHONE_ACCESS_HISTORY_SETTINGS_12_76"
        )
    },
    @{
        Name = "settings render"
        Value = $settings.Contains(
            "<PhoneAccessHistory />"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.76 validation failed : $($check.Name)"
    }
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $apiPath,
    $componentPath,
    $settingsPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination (
                $path +
                ".bak-12-76-" +
                $timestamp
            ) `
            -Force
    }
}

# ============================================================
# WRITE
# ============================================================

[System.IO.File]::WriteAllText(
    $apiPath,
    $apiContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $componentPath,
    $componentContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $settingsPath,
    $settings,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.76 APPLIQUE"
Write-Host "======================================"
Write-Host "Historique de confidentialite ajoute."
Write-Host "Revelations et appels visibles."
Write-Host "Aucun numero expose dans l historique."
Write-Host ""