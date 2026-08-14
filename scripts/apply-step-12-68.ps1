$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiDir = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact"

$apiPath = Join-Path `
    $apiDir `
    "route.ts"

$componentDir = Join-Path `
    $projectRoot `
    "app\components"

$componentPath = Join-Path `
    $componentDir `
    "BookingContactCard.tsx"

$bookingPath = Join-Path `
    $projectRoot `
    "app\bookings\[id]\page.tsx"

Write-Host ""
Write-Host "KLYX 12.68 - Secure Booking Contact"
Write-Host ""

foreach ($path in @(
    $bookingPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

New-Item `
    -ItemType Directory `
    -Force `
    -Path $apiDir |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $componentDir |
    Out-Null

# ============================================================
# API SECURISEE
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
    '// KLYX_SECURE_BOOKING_CONTACT_API_12_68'
    ''
    'type BookingRow = {'
    '  id: string;'
    '  parent_id: string;'
    '  provider_id: string | null;'
    '  babysitter_id: string | null;'
    '  status: string;'
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
    'function displayName('
    '  profile: ContactProfileRow'
    ') {'
    '  return ('
    '    ['
    '      profile.first_name,'
    '      profile.last_name,'
    '    ]'
    '      .filter(Boolean)'
    '      .join(" ") ||'
    '    "Utilisateur KLYX"'
    '  );'
    '}'
    ''
    'function contactAllowedStatus('
    '  status: string'
    ') {'
    '  return ('
    '    status === "accepted" ||'
    '    status === "completed"'
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
    '        { error: "Réservation manquante." },'
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
    '          "id, parent_id, provider_id, babysitter_id, status"'
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
    '        { error: "Réservation introuvable." },'
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
    '        {'
    '          error:'
    '            "Prestataire introuvable pour cette réservation.",'
    '        },'
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
    '        { error: "Accès refusé." },'
    '        { status: 403 }'
    '      );'
    '    }'
    ''
    '    if (!contactAllowedStatus('
    '      booking.status'
    '    )) {'
    '      return NextResponse.json({'
    '        contactAllowed: false,'
    '        phoneAvailable: false,'
    '        reason: "awaiting_acceptance",'
    '        message:'
    '          "Le numéro sera disponible après acceptation de la réservation.",'
    '      });'
    '    }'
    ''
    '    const otherProfileId ='
    '      isClient'
    '        ? providerId'
    '        : booking.parent_id;'
    ''
    '    const {'
    '      data: otherProfileData,'
    '      error: profileError,'
    '    } = await supabaseAdmin'
    '      .from("profiles")'
    '      .select('
    '        "id, first_name, last_name, phone_number, phone_verified_at, phone_visibility"'
    '      )'
    '      .eq("id", otherProfileId)'
    '      .maybeSingle();'
    ''
    '    if (profileError) {'
    '      throw new Error('
    '        profileError.message'
    '      );'
    '    }'
    ''
    '    if (!otherProfileData) {'
    '      return NextResponse.json('
    '        {'
    '          error:'
    '            "Profil de contact introuvable.",'
    '        },'
    '        { status: 404 }'
    '      );'
    '    }'
    ''
    '    const otherProfile ='
    '      otherProfileData as ContactProfileRow;'
    ''
    '    const visibility ='
    '      otherProfile.phone_visibility ??'
    '      "transaction_participants";'
    ''
    '    if (visibility === "private") {'
    '      return NextResponse.json({'
    '        contactAllowed: true,'
    '        phoneAvailable: false,'
    '        otherName:'
    '          displayName(otherProfile),'
    '        reason: "private",'
    '        message:'
    '          "Cette personne a choisi de garder son numéro privé.",'
    '      });'
    '    }'
    ''
    '    const phoneNumber ='
    '      otherProfile.phone_number?.trim() ||'
    '      null;'
    ''
    '    if (!phoneNumber) {'
    '      return NextResponse.json({'
    '        contactAllowed: true,'
    '        phoneAvailable: false,'
    '        otherName:'
    '          displayName(otherProfile),'
    '        reason: "missing_phone",'
    '        message:'
    '          "Cette personne n’a pas encore ajouté de numéro.",'
    '      });'
    '    }'
    ''
    '    return NextResponse.json({'
    '      contactAllowed: true,'
    '      phoneAvailable: true,'
    '      otherName:'
    '        displayName(otherProfile),'
    '      phoneNumber,'
    '      verified: Boolean('
    '        otherProfile.phone_verified_at'
    '      ),'
    '    });'
    '  } catch (error) {'
    '    const message ='
    '      error instanceof Error'
    '        ? error.message'
    '        : "Contact KLYX indisponible.";'
    ''
    '    return NextResponse.json('
    '      { error: message },'
    '      {'
    '        status: apiErrorStatus(message),'
    '      }'
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
# COMPOSANT CONTACT
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
    '  CheckCircle2,'
    '  LoaderCircle,'
    '  LockKeyhole,'
    '  Phone,'
    '  ShieldCheck,'
    '} from "lucide-react";'
    ''
    'import { supabase } from "@/lib/supabase";'
    ''
    '// KLYX_BOOKING_CONTACT_CARD_12_68'
    ''
    'type ContactPayload = {'
    '  contactAllowed?: boolean;'
    '  phoneAvailable?: boolean;'
    '  phoneNumber?: string | null;'
    '  otherName?: string;'
    '  verified?: boolean;'
    '  reason?: string;'
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
    'export default function BookingContactCard({'
    '  bookingId,'
    '  bookingStatus,'
    '  otherName,'
    '}: Props) {'
    '  const [loading, setLoading] ='
    '    useState(false);'
    ''
    '  const [loaded, setLoaded] ='
    '    useState(false);'
    ''
    '  const [payload, setPayload] ='
    '    useState<ContactPayload | null>('
    '      null'
    '    );'
    ''
    '  const canRequestContact ='
    '    bookingStatus === "accepted" ||'
    '    bookingStatus === "completed";'
    ''
    '  const loadContact = useCallback('
    '    async () => {'
    '      if (!canRequestContact) {'
    '        setPayload({'
    '          contactAllowed: false,'
    '          phoneAvailable: false,'
    '          message:'
    '            "Le numéro sera disponible après acceptation de la réservation.",'
    '        });'
    ''
    '        setLoaded(true);'
    '        return;'
    '      }'
    ''
    '      setLoading(true);'
    ''
    '      try {'
    '        const {'
    '          data: { session },'
    '        } ='
    '          await supabase.auth.getSession();'
    ''
    '        if (!session?.access_token) {'
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
    '                "Bearer " +'
    '                session.access_token,'
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
    '        setLoaded(true);'
    '      }'
    '    },'
    '    [bookingId, canRequestContact]'
    '  );'
    ''
    '  useEffect(() => {'
    '    setLoaded(false);'
    '    setPayload(null);'
    ''
    '    if (!canRequestContact) {'
    '      return;'
    '    }'
    ''
    '    void loadContact();'
    '  }, ['
    '    canRequestContact,'
    '    loadContact,'
    '  ]);'
    ''
    '  if (!canRequestContact) {'
    '    return ('
    '      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 dark:border-zinc-800">'
    '        <div className="flex items-start gap-3">'
    '          <LockKeyhole'
    '            size={20}'
    '            className="mt-0.5 shrink-0 text-muted-foreground"'
    '          />'
    ''
    '          <div>'
    '            <p className="font-bold">'
    '              Contact protégé'
    '            </p>'
    ''
    '            <p className="mt-1 text-sm leading-6 text-muted-foreground">'
    '              Le numéro de {otherName} sera accessible après acceptation de la réservation.'
    '            </p>'
    '          </div>'
    '        </div>'
    '      </div>'
    '    );'
    '  }'
    ''
    '  if (loading || !loaded) {'
    '    return ('
    '      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm font-semibold text-muted-foreground dark:border-zinc-800">'
    '        <LoaderCircle'
    '          size={18}'
    '          className="animate-spin"'
    '        />'
    '        Chargement du contact...'
    '      </div>'
    '    );'
    '  }'
    ''
    '  if ('
    '    !payload?.phoneAvailable ||'
    '    !payload.phoneNumber'
    '  ) {'
    '    return ('
    '      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 dark:border-zinc-800">'
    '        <div className="flex items-start gap-3">'
    '          <ShieldCheck'
    '            size={20}'
    '            className="mt-0.5 shrink-0 text-violet-500"'
    '          />'
    ''
    '          <div>'
    '            <p className="font-bold">'
    '              Contact KLYX'
    '            </p>'
    ''
    '            <p className="mt-1 text-sm leading-6 text-muted-foreground">'
    '              {payload?.error ||'
    '                payload?.message ||'
    '                "Numéro indisponible."}'
    '            </p>'
    '          </div>'
    '        </div>'
    '      </div>'
    '    );'
    '  }'
    ''
    '  const contactName ='
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
    '              Appeler {contactName}'
    '            </p>'
    ''
    '            {payload.verified && ('
    '              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-500">'
    '                <CheckCircle2 size={13} />'
    '                Vérifié'
    '              </span>'
    '            )}'
    '          </div>'
    ''
    '          <p className="mt-2 break-all text-base font-black">'
    '            {payload.phoneNumber}'
    '          </p>'
    ''
    '          <p className="mt-1 text-xs text-muted-foreground">'
    '            Visible uniquement parce que vous êtes liés par cette réservation.'
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
# PATCH BOOKING DETAILS
# ============================================================

$booking =
    [System.IO.File]::ReadAllText(
        $bookingPath
    )

$bookingMarker =
    "KLYX_SECURE_CONTACT_UI_12_68"

if (-not $booking.Contains(
    $bookingMarker
)) {
    $importAnchor =
        'import { getActiveClientProfile, type SavedAccount } from "@/lib/account-switcher";'

    if (-not $booking.Contains(
        $importAnchor
    )) {
        throw "Import anchor booking introuvable."
    }

    $booking =
        $booking.Replace(
            $importAnchor,
            $importAnchor +
            "`n" +
            'import BookingContactCard from "@/app/components/BookingContactCard";'
        )

    $profileCardAnchorLines = @(
        '              {booking.message && ('
    )

    $profileCardAnchor =
        [string]::Join(
            "`n",
            $profileCardAnchorLines
        )

    $anchorIndex =
        $booking.IndexOf(
            $profileCardAnchor
        )

    if ($anchorIndex -lt 0) {
        throw "Ancre apres profil reservation introuvable."
    }

    $contactBlockLines = @(
        '              {/* KLYX_SECURE_CONTACT_UI_12_68 */}'
        '              <BookingContactCard'
        '                bookingId={booking.id}'
        '                bookingStatus={booking.status}'
        '                otherName={otherName}'
        '              />'
        ''
    )

    $contactBlock =
        [string]::Join(
            "`n",
            $contactBlockLines
        )

    $booking =
        $booking.Substring(
            0,
            $anchorIndex
        ) +
        $contactBlock +
        $booking.Substring(
            $anchorIndex
        )
}

# ============================================================
# VERIFICATIONS
# ============================================================

$checks = @(
    @{
        Name = "API secure marker"
        Value = $apiContent.Contains(
            "KLYX_SECURE_BOOKING_CONTACT_API_12_68"
        )
    },
    @{
        Name = "participant client"
        Value = $apiContent.Contains(
            "booking.parent_id === profile.id"
        )
    },
    @{
        Name = "participant provider"
        Value = $apiContent.Contains(
            "providerId === profile.id"
        )
    },
    @{
        Name = "accepted gate"
        Value = $apiContent.Contains(
            'status === "accepted"'
        )
    },
    @{
        Name = "private gate"
        Value = $apiContent.Contains(
            'visibility === "private"'
        )
    },
    @{
        Name = "component"
        Value = $componentContent.Contains(
            "KLYX_BOOKING_CONTACT_CARD_12_68"
        )
    },
    @{
        Name = "tel link"
        Value = $componentContent.Contains(
            'href={"tel:" + payload.phoneNumber}'
        )
    },
    @{
        Name = "booking UI"
        Value = $booking.Contains(
            "KLYX_SECURE_CONTACT_UI_12_68"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "Verification 12.68 echouee : $($check.Name)"
    }
}

# ============================================================
# BACKUPS + ECRITURE
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $apiPath,
    $componentPath,
    $bookingPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination (
                $path +
                ".bak-12-68-" +
                $timestamp
            ) `
            -Force
    }
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding(
        $false
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

[System.IO.File]::WriteAllText(
    $bookingPath,
    $booking,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.68 APPLIQUE"
Write-Host "======================================"
Write-Host "Numero jamais public."
Write-Host "Client et prestataire verifies cote serveur."
Write-Host "Contact disponible apres acceptation."
Write-Host "Bouton Appeler ajoute aux reservations."
Write-Host ""