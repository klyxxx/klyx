$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$migrationsDir = Join-Path $projectRoot "supabase\migrations"

$migrationPath = Join-Path `
    $migrationsDir `
    "20260812183500_klyx_phone_contact_audit_12_72.sql"

$apiPath = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BookingContactCard.tsx"

Write-Host ""
Write-Host "KLYX 12.72 - Contact Expiration + Audit"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $componentPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $migrationsDir |
    Out-Null

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

# ============================================================
# MIGRATION
# ============================================================

$migrationLines = @(
"-- KLYX_PHONE_CONTACT_AUDIT_12_72"
""
"create table if not exists public.phone_contact_access_logs ("
"  id uuid primary key default gen_random_uuid(),"
"  booking_id uuid not null references public.bookings(id) on delete cascade,"
"  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,"
"  contact_profile_id uuid not null references public.profiles(id) on delete cascade,"
"  event_type text not null default 'phone_reveal',"
"  created_at timestamptz not null default now()"
");"
""
"alter table public.phone_contact_access_logs"
"  enable row level security;"
""
"revoke all on table public.phone_contact_access_logs"
"  from anon, authenticated;"
""
"create index if not exists phone_contact_logs_booking_idx"
"  on public.phone_contact_access_logs (booking_id, created_at desc);"
""
"create index if not exists phone_contact_logs_viewer_idx"
"  on public.phone_contact_access_logs (viewer_profile_id, created_at desc);"
""
"comment on table public.phone_contact_access_logs is"
"  'KLYX server-only audit trail for authorized phone reveals.';"
)

$migrationContent =
    [string]::Join(
        "`n",
        $migrationLines
    )

# ============================================================
# SECURE CONTACT API
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
'// KLYX_PHONE_CONTACT_EXPIRATION_AUDIT_12_72'
''
'type BookingRow = {'
'  id: string;'
'  parent_id: string;'
'  provider_id: string | null;'
'  babysitter_id: string | null;'
'  status: string;'
'  completed_at: string | null;'
'};'
''
'type ContactProfileRow = {'
'  id: string;'
'  first_name: string | null;'
'  last_name: string | null;'
'  phone_number: string | null;'
'  phone_verified_at: string | null;'
'  phone_visibility: string | null;'
'};'
''
'const COMPLETED_CONTACT_HOURS = 24;'
''
'function formatName('
'  profile: ContactProfileRow'
') {'
'  return ('
'    [profile.first_name, profile.last_name]'
'      .filter(Boolean)'
'      .join(" ") ||'
'    "Utilisateur KLYX"'
'  );'
'}'
''
'function isTransactionVisible('
'  profile: ContactProfileRow'
') {'
'  return ('
'    profile.phone_visibility == null ||'
'    profile.phone_visibility ==='
'      "transaction_participants"'
'  );'
'}'
''
'function completedAccessExpiresAt('
'  completedAt: string'
') {'
'  return new Date('
'    new Date(completedAt).getTime() +'
'      COMPLETED_CONTACT_HOURS *'
'        60 *'
'        60 *'
'        1000'
'  );'
'}'
''
'export async function GET('
'  request: Request,'
'  context: {'
'    params: Promise<{ id: string }>;'
'  }'
') {'
'  try {'
'    const { id: bookingId } ='
'      await context.params;'
''
'    if (!bookingId) {'
'      return NextResponse.json('
'        { error: "Reservation manquante." },'
'        { status: 400 }'
'      );'
'    }'
''
'    const { profile } ='
'      await getAuthenticatedProfile(request);'
''
'    const { data, error } ='
'      await supabaseAdmin'
'        .from("bookings")'
'        .select('
'          "id, parent_id, provider_id, babysitter_id, status, completed_at"'
'        )'
'        .eq("id", bookingId)'
'        .maybeSingle();'
''
'    if (error) {'
'      throw new Error(error.message);'
'    }'
''
'    if (!data) {'
'      return NextResponse.json('
'        { error: "Reservation introuvable." },'
'        { status: 404 }'
'      );'
'    }'
''
'    const booking = data as BookingRow;'
''
'    const providerId ='
'      booking.provider_id ??'
'      booking.babysitter_id;'
''
'    if (!providerId) {'
'      return NextResponse.json('
'        { error: "Prestataire introuvable." },'
'        { status: 409 }'
'      );'
'    }'
''
'    const isClient ='
'      booking.parent_id === profile.id;'
''
'    const isProvider ='
'      providerId === profile.id;'
''
'    if (!isClient && !isProvider) {'
'      return NextResponse.json('
'        { error: "Acces refuse." },'
'        { status: 403 }'
'      );'
'    }'
''
'    if ('
'      booking.status !== "accepted" &&'
'      booking.status !== "completed"'
'    ) {'
'      return NextResponse.json({'
'        contactAllowed: false,'
'        phoneAvailable: false,'
'        reason: "status_not_allowed",'
'        message:'
'          "Le contact telephonique est disponible uniquement pour une mission acceptee.",'
'      });'
'    }'
''
'    let accessExpiresAt: string | null = null;'
''
'    if (booking.status === "completed") {'
'      if (!booking.completed_at) {'
'        return NextResponse.json({'
'          contactAllowed: false,'
'          phoneAvailable: false,'
'          reason: "missing_completion_time",'
'          message:'
'            "La periode de contact de cette mission ne peut pas etre determinee.",'
'        });'
'      }'
''
'      const expiresAt ='
'        completedAccessExpiresAt('
'          booking.completed_at'
'        );'
''
'      accessExpiresAt ='
'        expiresAt.toISOString();'
''
'      if (expiresAt.getTime() <= Date.now()) {'
'        return NextResponse.json({'
'          contactAllowed: false,'
'          phoneAvailable: false,'
'          reason: "contact_expired",'
'          accessExpiresAt,'
'          message:'
'            "La periode de contact telephonique de cette mission est terminee.",'
'        });'
'      }'
'    }'
''
'    const otherProfileId ='
'      isClient'
'        ? providerId'
'        : booking.parent_id;'
''
'    const {'
'      data: profilesData,'
'      error: profilesError,'
'    } = await supabaseAdmin'
'      .from("profiles")'
'      .select('
'        "id, first_name, last_name, phone_number, phone_verified_at, phone_visibility"'
'      )'
'      .in("id", ['
'        profile.id,'
'        otherProfileId,'
'      ]);'
''
'    if (profilesError) {'
'      throw new Error('
'        profilesError.message'
'      );'
'    }'
''
'    const profiles ='
'      (profilesData ?? []) as ContactProfileRow[];'
''
'    const ownProfile ='
'      profiles.find('
'        (item) => item.id === profile.id'
'      );'
''
'    const otherProfile ='
'      profiles.find('
'        (item) =>'
'          item.id === otherProfileId'
'      );'
''
'    if (!ownProfile || !otherProfile) {'
'      return NextResponse.json('
'        { error: "Profil de contact introuvable." },'
'        { status: 404 }'
'      );'
'    }'
''
'    const otherName ='
'      formatName(otherProfile);'
''
'    const ownPhone ='
'      ownProfile.phone_number?.trim() ?? "";'
''
'    if (!ownPhone) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        accessExpiresAt,'
'        actionRequired: "verify_own_phone",'
'        reason: "own_missing_phone",'
'        message:'
'          "Ajoute ton numero pour utiliser le contact telephonique.",'
'      });'
'    }'
''
'    if (!ownProfile.phone_verified_at) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        accessExpiresAt,'
'        actionRequired: "verify_own_phone",'
'        reason: "own_unverified_phone",'
'        message:'
'          "Verifie ton numero par SMS pour utiliser le contact telephonique.",'
'      });'
'    }'
''
'    if (!isTransactionVisible(ownProfile)) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        accessExpiresAt,'
'        actionRequired: "verify_own_phone",'
'        reason: "own_private_phone",'
'        message:'
'          "Ton numero est actuellement prive.",'
'      });'
'    }'
''
'    const otherPhone ='
'      otherProfile.phone_number?.trim() ?? "";'
''
'    if (!otherPhone) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        accessExpiresAt,'
'        reason: "other_missing_phone",'
'        message:'
'          otherName +'
'          " n a pas encore ajoute de numero.",'
'      });'
'    }'
''
'    if (!otherProfile.phone_verified_at) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        accessExpiresAt,'
'        reason: "other_unverified_phone",'
'        message:'
'          "Le numero de " +'
'          otherName +'
'          " doit encore etre verifie.",'
'      });'
'    }'
''
'    if (!isTransactionVisible(otherProfile)) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        accessExpiresAt,'
'        reason: "other_private_phone",'
'        message:'
'          otherName +'
'          " ne partage pas son numero.",'
'      });'
'    }'
''
'    const { error: auditError } ='
'      await supabaseAdmin'
'        .from("phone_contact_access_logs")'
'        .insert({'
'          booking_id: booking.id,'
'          viewer_profile_id: profile.id,'
'          contact_profile_id:'
'            otherProfile.id,'
'          event_type: "phone_reveal",'
'        });'
''
'    if (auditError) {'
'      throw new Error('
'        "Journal de securite indisponible : " +'
'          auditError.message'
'      );'
'    }'
''
'    return NextResponse.json({'
'      contactAllowed: true,'
'      phoneAvailable: true,'
'      mutualVerification: true,'
'      audited: true,'
'      otherName,'
'      phoneNumber: otherPhone,'
'      verified: true,'
'      accessExpiresAt,'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Contact KLYX indisponible.";'
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
# CONTACT UI
# ============================================================

$componentLines = @(
'"use client";'
''
'import Link from "next/link";'
'import {'
'  useCallback,'
'  useEffect,'
'  useState,'
'} from "react";'
'import {'
'  CheckCircle2,'
'  Clock3,'
'  LoaderCircle,'
'  LockKeyhole,'
'  Phone,'
'  ShieldCheck,'
'  Smartphone,'
'} from "lucide-react";'
''
'import { supabase } from "@/lib/supabase";'
''
'// KLYX_PHONE_CONTACT_EXPIRATION_UI_12_72'
''
'type ContactPayload = {'
'  contactAllowed?: boolean;'
'  phoneAvailable?: boolean;'
'  mutualVerification?: boolean;'
'  audited?: boolean;'
'  phoneNumber?: string | null;'
'  otherName?: string;'
'  verified?: boolean;'
'  accessExpiresAt?: string | null;'
'  reason?: string;'
'  actionRequired?: string;'
'  message?: string;'
'  error?: string;'
'};'
''
'type Props = {'
'  bookingId: string;'
'  bookingStatus: string;'
'  otherName: string;'
'};'
''
'function formatExpiry('
'  value: string'
') {'
'  return new Intl.DateTimeFormat('
'    "fr-BE",'
'    {'
'      day: "2-digit",'
'      month: "2-digit",'
'      hour: "2-digit",'
'      minute: "2-digit",'
'    }'
'  ).format(new Date(value));'
'}'
''
'export default function BookingContactCard({'
'  bookingId,'
'  bookingStatus,'
'  otherName,'
'}: Props) {'
'  const [loading, setLoading] ='
'    useState(false);'
''
'  const [payload, setPayload] ='
'    useState<ContactPayload | null>(null);'
''
'  const statusAllowsContact ='
'    bookingStatus === "accepted" ||'
'    bookingStatus === "completed";'
''
'  const loadContact = useCallback('
'    async () => {'
'      if (!statusAllowsContact) return;'
''
'      setLoading(true);'
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
'          "/api/bookings/" +'
'            encodeURIComponent(bookingId) +'
'            "/contact",'
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
'          (await response.json()) as ContactPayload;'
''
'        if (!response.ok) {'
'          throw new Error('
'            result.error ||'
'              "Contact indisponible."'
'          );'
'        }'
''
'        setPayload(result);'
'      } catch (error) {'
'        setPayload({'
'          contactAllowed: false,'
'          phoneAvailable: false,'
'          error:'
'            error instanceof Error'
'              ? error.message'
'              : "Contact indisponible.",'
'        });'
'      } finally {'
'        setLoading(false);'
'      }'
'    },'
'    [bookingId, statusAllowsContact]'
'  );'
''
'  useEffect(() => {'
'    setPayload(null);'
''
'    if (statusAllowsContact) {'
'      void loadContact();'
'    }'
'  }, ['
'    statusAllowsContact,'
'    loadContact,'
'  ]);'
''
'  if (!statusAllowsContact) {'
'    return ('
'      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 dark:border-zinc-800">'
'        <div className="flex items-start gap-3">'
'          <LockKeyhole'
'            size={20}'
'            className="mt-0.5 shrink-0 text-muted-foreground"'
'          />'
''
'          <div>'
'            <p className="font-black">'
'              Contact protege'
'            </p>'
''
'            <p className="mt-1 text-sm leading-6 text-muted-foreground">'
'              Le numero devient disponible apres acceptation de la reservation.'
'            </p>'
'          </div>'
'        </div>'
'      </div>'
'    );'
'  }'
''
'  if (loading || !payload) {'
'    return ('
'      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground dark:border-zinc-800">'
'        <LoaderCircle'
'          size={18}'
'          className="animate-spin"'
'        />'
'        Verification du contact...'
'      </div>'
'    );'
'  }'
''
'  const ownAction ='
'    payload.actionRequired ==='
'    "verify_own_phone";'
''
'  if ('
'    !payload.phoneAvailable ||'
'    !payload.phoneNumber'
'  ) {'
'    return ('
'      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 dark:border-zinc-800">'
'        <div className="flex items-start gap-3">'
'          {ownAction ? ('
'            <Smartphone'
'              size={20}'
'              className="mt-0.5 shrink-0 text-amber-500"'
'            />'
'          ) : ('
'            <ShieldCheck'
'              size={20}'
'              className="mt-0.5 shrink-0 text-violet-500"'
'            />'
'          )}'
''
'          <div className="min-w-0 flex-1">'
'            <p className="font-black">'
'              {payload.reason === "contact_expired"'
'                ? "Contact expire"'
'                : ownAction'
'                  ? "Ton numero doit etre verifie"'
'                  : "Contact KLYX protege"}'
'            </p>'
''
'            <p className="mt-1 text-sm leading-6 text-muted-foreground">'
'              {payload.error ||'
'                payload.message ||'
'                "Numero indisponible."}'
'            </p>'
''
'            {ownAction && ('
'              <Link'
'                href="/settings"'
'                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white hover:bg-violet-500"'
'              >'
'                <Smartphone size={17} />'
'                Verifier mon numero'
'              </Link>'
'            )}'
'          </div>'
'        </div>'
'      </div>'
'    );'
'  }'
''
'  const name ='
'    payload.otherName || otherName;'
''
'  return ('
'    <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 sm:p-5">'
'      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">'
'        <div className="min-w-0">'
'          <div className="flex flex-wrap items-center gap-2">'
'            <Phone'
'              size={18}'
'              className="text-emerald-500"'
'            />'
''
'            <p className="font-black">'
'              Appeler {name}'
'            </p>'
''
'            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-500">'
'              <CheckCircle2 size={13} />'
'              Contact verifie'
'            </span>'
'          </div>'
''
'          <p className="mt-2 break-all text-base font-black">'
'            {payload.phoneNumber}'
'          </p>'
''
'          {payload.accessExpiresAt ? ('
'            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">'
'              <Clock3 size={14} />'
'              Contact disponible jusqu au{" "}'
'              {formatExpiry('
'                payload.accessExpiresAt'
'              )}'
'            </p>'
'          ) : ('
'            <p className="mt-2 text-xs text-muted-foreground">'
'              Contact actif pendant la mission.'
'            </p>'
'          )}'
''
'          <p className="mt-1 text-xs leading-5 text-muted-foreground">'
'            Acces protege et journalise par KLYX.'
'          </p>'
'        </div>'
''
'        <a'
'          href={"tel:" + payload.phoneNumber}'
'          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white transition hover:bg-emerald-500"'
'        >'
'          <Phone size={18} />'
'          Appeler'
'        </a>'
'      </div>'
'    </div>'
'  );'
'}'
)

$componentContent =
    [string]::Join(
        "`n",
        $componentLines
    )

# ============================================================
# STATIC VALIDATION
# ============================================================

$checks = @(
    @{
        Name = "audit migration"
        Value = $migrationContent.Contains(
            "KLYX_PHONE_CONTACT_AUDIT_12_72"
        )
    },
    @{
        Name = "audit table"
        Value = $migrationContent.Contains(
            "phone_contact_access_logs"
        )
    },
    @{
        Name = "API marker"
        Value = $apiContent.Contains(
            "KLYX_PHONE_CONTACT_EXPIRATION_AUDIT_12_72"
        )
    },
    @{
        Name = "24 hour window"
        Value = $apiContent.Contains(
            "COMPLETED_CONTACT_HOURS = 24"
        )
    },
    @{
        Name = "accepted status"
        Value = $apiContent.Contains(
            'booking.status !== "accepted"'
        )
    },
    @{
        Name = "completed status"
        Value = $apiContent.Contains(
            'booking.status !== "completed"'
        )
    },
    @{
        Name = "audit insert"
        Value = $apiContent.Contains(
            '.from("phone_contact_access_logs")'
        )
    },
    @{
        Name = "UI marker"
        Value = $componentContent.Contains(
            "KLYX_PHONE_CONTACT_EXPIRATION_UI_12_72"
        )
    },
    @{
        Name = "tel link"
        Value = $componentContent.Contains(
            'href={"tel:" + payload.phoneNumber}'
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.72 validation failed : $($check.Name)"
    }
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $migrationPath,
    $apiPath,
    $componentPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination (
                $path +
                ".bak-12-72-" +
                $timestamp
            ) `
            -Force
    }
}

# ============================================================
# WRITE
# ============================================================

[System.IO.File]::WriteAllText(
    $migrationPath,
    $migrationContent,
    $utf8NoBom
)

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

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.72 APPLIQUE"
Write-Host "======================================"
Write-Host "Contact accepte pendant mission."
Write-Host "Contact termine expire apres 24h."
Write-Host "Chaque revelation est journalisee."
Write-Host "Numero toujours protege cote serveur."
Write-Host ""