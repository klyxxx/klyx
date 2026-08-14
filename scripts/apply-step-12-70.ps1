$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\bookings\[id]\contact\route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BookingContactCard.tsx"

Write-Host ""
Write-Host "KLYX 12.70 - Mutual Verified Contact"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $componentPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier introuvable : $path"
    }
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

# ============================================================
# API COMPLETE
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
'// KLYX_MUTUAL_VERIFIED_CONTACT_API_12_70'
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
'function canRevealAtStatus('
'  status: string'
') {'
'  return ('
'    status === "accepted" ||'
'    status === "completed"'
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
'    if (!canRevealAtStatus(booking.status)) {'
'      return NextResponse.json({'
'        contactAllowed: false,'
'        phoneAvailable: false,'
'        reason: "awaiting_acceptance",'
'        message:'
'          "Le contact sera disponible apres acceptation de la reservation.",'
'      });'
'    }'
''
'    const otherProfileId ='
'      isClient'
'        ? providerId'
'        : booking.parent_id;'
''
'    const { data: profilesData, error: profilesError } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .select('
'          "id, first_name, last_name, phone_number, phone_verified_at, phone_visibility"'
'        )'
'        .in("id", [profile.id, otherProfileId]);'
''
'    if (profilesError) {'
'      throw new Error(profilesError.message);'
'    }'
''
'    const profiles ='
'      (profilesData ?? []) as ContactProfileRow[];'
''
'    const ownProfile = profiles.find('
'      (item) => item.id === profile.id'
'    );'
''
'    const otherProfile = profiles.find('
'      (item) => item.id === otherProfileId'
'    );'
''
'    if (!ownProfile) {'
'      return NextResponse.json('
'        { error: "Ton profil KLYX est introuvable." },'
'        { status: 404 }'
'      );'
'    }'
''
'    if (!otherProfile) {'
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
'        reason: "own_missing_phone",'
'        actionRequired: "verify_own_phone",'
'        message:'
'          "Ajoute ton numero avant d acceder au contact telephonique.",'
'      });'
'    }'
''
'    if (!ownProfile.phone_verified_at) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        reason: "own_unverified_phone",'
'        actionRequired: "verify_own_phone",'
'        message:'
'          "Verifie ton numero par SMS avant d acceder au contact telephonique.",'
'      });'
'    }'
''
'    if (!isTransactionVisible(ownProfile)) {'
'      return NextResponse.json({'
'        contactAllowed: true,'
'        phoneAvailable: false,'
'        otherName,'
'        reason: "own_private_phone",'
'        actionRequired: "verify_own_phone",'
'        message:'
'          "Active le partage du numero avec les participants de mission.",'
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
'        reason: "other_private_phone",'
'        message:'
'          otherName +'
'          " ne partage pas son numero actuellement.",'
'      });'
'    }'
''
'    return NextResponse.json({'
'      contactAllowed: true,'
'      phoneAvailable: true,'
'      mutualVerification: true,'
'      otherName,'
'      phoneNumber: otherPhone,'
'      verified: true,'
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
# CONTACT CARD COMPLETE
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
'  LoaderCircle,'
'  LockKeyhole,'
'  Phone,'
'  ShieldCheck,'
'  Smartphone,'
'} from "lucide-react";'
''
'import { supabase } from "@/lib/supabase";'
''
'// KLYX_MUTUAL_VERIFIED_CONTACT_UI_12_70'
''
'type ContactPayload = {'
'  contactAllowed?: boolean;'
'  phoneAvailable?: boolean;'
'  mutualVerification?: boolean;'
'  phoneNumber?: string | null;'
'  otherName?: string;'
'  verified?: boolean;'
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
'  const contactStatusAllowed ='
'    bookingStatus === "accepted" ||'
'    bookingStatus === "completed";'
''
'  const loadContact = useCallback('
'    async () => {'
'      if (!contactStatusAllowed) return;'
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
'    [bookingId, contactStatusAllowed]'
'  );'
''
'  useEffect(() => {'
'    setPayload(null);'
''
'    if (contactStatusAllowed) {'
'      void loadContact();'
'    }'
'  }, ['
'    contactStatusAllowed,'
'    loadContact,'
'  ]);'
''
'  if (!contactStatusAllowed) {'
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
'              Contact protege'
'            </p>'
''
'            <p className="mt-1 text-sm leading-6 text-muted-foreground">'
'              Le numero de {otherName} sera accessible apres acceptation de la reservation.'
'            </p>'
'          </div>'
'        </div>'
'      </div>'
'    );'
'  }'
''
'  if (loading || !payload) {'
'    return ('
'      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm font-semibold text-muted-foreground dark:border-zinc-800">'
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
'              {ownAction'
'                ? "Ton numero doit etre verifie"'
'                : "Contact KLYX protege"}'
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
'                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"'
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
'              Deux numeros verifies'
'            </span>'
'          </div>'
''
'          <p className="mt-2 break-all text-base font-black">'
'            {payload.phoneNumber}'
'          </p>'
''
'          <p className="mt-1 text-xs leading-5 text-muted-foreground">'
'            KLYX affiche ce numero uniquement aux deux participants verifies de cette reservation.'
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
# STATIC CHECK BEFORE WRITE
# ============================================================

$checks = @(
    @{
        Name = "API marker"
        Value = $apiContent.Contains(
            "KLYX_MUTUAL_VERIFIED_CONTACT_API_12_70"
        )
    },
    @{
        Name = "own verified gate"
        Value = $apiContent.Contains(
            "!ownProfile.phone_verified_at"
        )
    },
    @{
        Name = "other verified gate"
        Value = $apiContent.Contains(
            "!otherProfile.phone_verified_at"
        )
    },
    @{
        Name = "participant gate"
        Value =
            $apiContent.Contains(
                "booking.parent_id === profile.id"
            ) -and
            $apiContent.Contains(
                "providerId === profile.id"
            )
    },
    @{
        Name = "status gate"
        Value =
            $apiContent.Contains(
                'status === "accepted"'
            ) -and
            $apiContent.Contains(
                'status === "completed"'
            )
    },
    @{
        Name = "UI marker"
        Value = $componentContent.Contains(
            "KLYX_MUTUAL_VERIFIED_CONTACT_UI_12_70"
        )
    },
    @{
        Name = "settings action"
        Value = $componentContent.Contains(
            'href="/settings"'
        )
    },
    @{
        Name = "tel action"
        Value = $componentContent.Contains(
            'href={"tel:" + payload.phoneNumber}'
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.70 validation failed : $($check.Name)"
    }
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $apiPath,
    $componentPath
)) {
    Copy-Item `
        -LiteralPath $path `
        -Destination (
            $path +
            ".bak-12-70-" +
            $timestamp
        ) `
        -Force
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

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.70 APPLIQUE"
Write-Host "======================================"
Write-Host "Verification mutuelle obligatoire."
Write-Host "Numero non verifie jamais revele."
Write-Host "Bouton Settings si ton numero bloque."
Write-Host "Contact reserve aux participants."
Write-Host ""