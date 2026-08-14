$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiDir = Join-Path $projectRoot "app\api\bookings\[id]\contact"
$componentDir = Join-Path $projectRoot "app\components"

$apiPath = Join-Path $apiDir "route.ts"
$componentPath = Join-Path $componentDir "BookingContactCard.tsx"
$bookingPath = Join-Path $projectRoot "app\bookings\[id]\page.tsx"

Write-Host ""
Write-Host "KLYX 12.68b - Secure Booking Contact"
Write-Host ""

if (-not (Test-Path -LiteralPath $bookingPath)) {
    throw "app/bookings/[id]/page.tsx introuvable."
}

New-Item -ItemType Directory -Force -Path $apiDir | Out-Null
New-Item -ItemType Directory -Force -Path $componentDir | Out-Null

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# ============================================================
# API
# ============================================================

$apiLines = @(
"import { NextResponse } from 'next/server';"
""
"import { getAuthenticatedProfile } from '@/lib/api-auth';"
"import { supabaseAdmin } from '@/lib/supabase-admin';"
""
"// KLYX_SECURE_BOOKING_CONTACT_API_12_68B"
""
"type BookingRow = {"
"  id: string;"
"  parent_id: string;"
"  provider_id: string | null;"
"  babysitter_id: string | null;"
"  status: string;"
"};"
""
"type ContactProfile = {"
"  id: string;"
"  first_name: string | null;"
"  last_name: string | null;"
"  phone_number: string | null;"
"  phone_verified_at: string | null;"
"  phone_visibility: string | null;"
"};"
""
"function contactName(profile: ContactProfile) {"
"  return ("
"    [profile.first_name, profile.last_name]"
"      .filter(Boolean)"
"      .join(' ') || 'Utilisateur KLYX'"
"  );"
"}"
""
"function canRevealPhone(status: string) {"
"  return status === 'accepted' || status === 'completed';"
"}"
""
"export async function GET("
"  request: Request,"
"  context: { params: Promise<{ id: string }> }"
") {"
"  try {"
"    const { id: bookingId } = await context.params;"
""
"    const { profile } = await getAuthenticatedProfile(request);"
""
"    const { data, error } = await supabaseAdmin"
"      .from('bookings')"
"      .select("
"        'id, parent_id, provider_id, babysitter_id, status'"
"      )"
"      .eq('id', bookingId)"
"      .maybeSingle();"
""
"    if (error) {"
"      throw new Error(error.message);"
"    }"
""
"    if (!data) {"
"      return NextResponse.json("
"        { error: 'Reservation introuvable.' },"
"        { status: 404 }"
"      );"
"    }"
""
"    const booking = data as BookingRow;"
""
"    const providerId ="
"      booking.provider_id ?? booking.babysitter_id;"
""
"    if (!providerId) {"
"      return NextResponse.json("
"        { error: 'Prestataire introuvable.' },"
"        { status: 409 }"
"      );"
"    }"
""
"    const isClient = booking.parent_id === profile.id;"
"    const isProvider = providerId === profile.id;"
""
"    if (!isClient && !isProvider) {"
"      return NextResponse.json("
"        { error: 'Acces refuse.' },"
"        { status: 403 }"
"      );"
"    }"
""
"    if (!canRevealPhone(booking.status)) {"
"      return NextResponse.json({"
"        contactAllowed: false,"
"        phoneAvailable: false,"
"        message:"
"          'Le numero devient disponible apres acceptation de la reservation.',"
"      });"
"    }"
""
"    const otherProfileId = isClient"
"      ? providerId"
"      : booking.parent_id;"
""
"    const { data: otherData, error: otherError } ="
"      await supabaseAdmin"
"        .from('profiles')"
"        .select("
"          'id, first_name, last_name, phone_number, phone_verified_at, phone_visibility'"
"        )"
"        .eq('id', otherProfileId)"
"        .maybeSingle();"
""
"    if (otherError) {"
"      throw new Error(otherError.message);"
"    }"
""
"    if (!otherData) {"
"      return NextResponse.json("
"        { error: 'Profil de contact introuvable.' },"
"        { status: 404 }"
"      );"
"    }"
""
"    const otherProfile = otherData as ContactProfile;"
""
"    const visibility ="
"      otherProfile.phone_visibility ??"
"      'transaction_participants';"
""
"    if (visibility === 'private') {"
"      return NextResponse.json({"
"        contactAllowed: true,"
"        phoneAvailable: false,"
"        otherName: contactName(otherProfile),"
"        message:"
"          'Cette personne garde son numero prive.',"
"      });"
"    }"
""
"    const phoneNumber ="
"      otherProfile.phone_number?.trim() ?? '';"
""
"    if (!phoneNumber) {"
"      return NextResponse.json({"
"        contactAllowed: true,"
"        phoneAvailable: false,"
"        otherName: contactName(otherProfile),"
"        message:"
"          'Cette personne n a pas encore ajoute de numero.',"
"      });"
"    }"
""
"    return NextResponse.json({"
"      contactAllowed: true,"
"      phoneAvailable: true,"
"      otherName: contactName(otherProfile),"
"      phoneNumber,"
"      verified: Boolean(otherProfile.phone_verified_at),"
"    });"
"  } catch (error) {"
"    const message ="
"      error instanceof Error"
"        ? error.message"
"        : 'Contact KLYX indisponible.';"
""
"    return NextResponse.json("
"      { error: message },"
"      { status: 500 }"
"    );"
"  }"
"}"
)

$apiContent = [string]::Join("`n", $apiLines)

# ============================================================
# COMPONENT
# ============================================================

$componentLines = @(
"'use client';"
""
"import { useCallback, useEffect, useState } from 'react';"
"import {"
"  CheckCircle2,"
"  LoaderCircle,"
"  LockKeyhole,"
"  Phone,"
"  ShieldCheck,"
"} from 'lucide-react';"
""
"import { supabase } from '@/lib/supabase';"
""
"// KLYX_BOOKING_CONTACT_CARD_12_68B"
""
"type ContactPayload = {"
"  contactAllowed?: boolean;"
"  phoneAvailable?: boolean;"
"  phoneNumber?: string | null;"
"  otherName?: string;"
"  verified?: boolean;"
"  message?: string;"
"  error?: string;"
"};"
""
"type Props = {"
"  bookingId: string;"
"  bookingStatus: string;"
"  otherName: string;"
"};"
""
"export default function BookingContactCard({"
"  bookingId,"
"  bookingStatus,"
"  otherName,"
"}: Props) {"
"  const [loading, setLoading] = useState(false);"
"  const [payload, setPayload] ="
"    useState<ContactPayload | null>(null);"
""
"  const contactAllowed ="
"    bookingStatus === 'accepted' ||"
"    bookingStatus === 'completed';"
""
"  const loadContact = useCallback(async () => {"
"    if (!contactAllowed) return;"
""
"    setLoading(true);"
""
"    try {"
"      const { data } = await supabase.auth.getSession();"
"      const token = data.session?.access_token;"
""
"      if (!token) {"
"        throw new Error('Session KLYX introuvable.');"
"      }"
""
"      const response = await fetch("
"        '/api/bookings/' +"
"          encodeURIComponent(bookingId) +"
"          '/contact',"
"        {"
"          cache: 'no-store',"
"          headers: {"
"            Authorization: 'Bearer ' + token,"
"          },"
"        }"
"      );"
""
"      const result ="
"        (await response.json()) as ContactPayload;"
""
"      if (!response.ok) {"
"        throw new Error("
"          result.error || 'Contact indisponible.'"
"        );"
"      }"
""
"      setPayload(result);"
"    } catch (error) {"
"      setPayload({"
"        phoneAvailable: false,"
"        error:"
"          error instanceof Error"
"            ? error.message"
"            : 'Contact indisponible.',"
"      });"
"    } finally {"
"      setLoading(false);"
"    }"
"  }, [bookingId, contactAllowed]);"
""
"  useEffect(() => {"
"    setPayload(null);"
""
"    if (contactAllowed) {"
"      void loadContact();"
"    }"
"  }, [contactAllowed, loadContact]);"
""
"  if (!contactAllowed) {"
"    return ("
"      <div className='mt-4 rounded-2xl border border-border bg-muted/30 p-4'>"
"        <div className='flex items-start gap-3'>"
"          <LockKeyhole"
"            size={19}"
"            className='mt-0.5 shrink-0 text-muted-foreground'"
"          />"
""
"          <div>"
"            <p className='font-bold'>Contact protege</p>"
"            <p className='mt-1 text-sm text-muted-foreground'>"
"              Le numero de {otherName} sera disponible apres acceptation."
"            </p>"
"          </div>"
"        </div>"
"      </div>"
"    );"
"  }"
""
"  if (loading || !payload) {"
"    return ("
"      <div className='mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground'>"
"        <LoaderCircle size={18} className='animate-spin' />"
"        Chargement du contact..."
"      </div>"
"    );"
"  }"
""
"  if (!payload.phoneAvailable || !payload.phoneNumber) {"
"    return ("
"      <div className='mt-4 rounded-2xl border border-border bg-muted/30 p-4'>"
"        <div className='flex items-start gap-3'>"
"          <ShieldCheck"
"            size={19}"
"            className='mt-0.5 shrink-0 text-violet-500'"
"          />"
""
"          <div>"
"            <p className='font-bold'>Contact KLYX</p>"
"            <p className='mt-1 text-sm text-muted-foreground'>"
"              {payload.error ||"
"                payload.message ||"
"                'Numero indisponible.'}"
"            </p>"
"          </div>"
"        </div>"
"      </div>"
"    );"
"  }"
""
"  const name = payload.otherName || otherName;"
""
"  return ("
"    <div className='mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5'>"
"      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>"
"        <div className='min-w-0'>"
"          <div className='flex flex-wrap items-center gap-2'>"
"            <Phone size={18} className='text-emerald-500' />"
"            <p className='font-black'>Appeler {name}</p>"
""
"            {payload.verified && ("
"              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-500'>"
"                <CheckCircle2 size={13} />"
"                Verifie"
"              </span>"
"            )}"
"          </div>"
""
"          <p className='mt-2 break-all text-base font-black'>"
"            {payload.phoneNumber}"
"          </p>"
""
"          <p className='mt-1 text-xs text-muted-foreground'>"
"            Visible uniquement pour cette reservation."
"          </p>"
"        </div>"
""
"        <a"
"          href={'tel:' + payload.phoneNumber}"
"          className='inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white hover:bg-emerald-500'"
"        >"
"          <Phone size={18} />"
"          Appeler"
"        </a>"
"      </div>"
"    </div>"
"  );"
"}"
)

$componentContent = [string]::Join("`n", $componentLines)

# ============================================================
# PATCH BOOKING PAGE
# ============================================================

$booking = [System.IO.File]::ReadAllText($bookingPath)

$marker = "KLYX_SECURE_CONTACT_UI_12_68B"

if (-not $booking.Contains($marker)) {

    $importAnchor =
        'import { getActiveClientProfile, type SavedAccount } from "@/lib/account-switcher";'

    if (-not $booking.Contains($importAnchor)) {
        throw "Import account-switcher introuvable."
    }

    if (-not $booking.Contains(
        'import BookingContactCard from "@/app/components/BookingContactCard";'
    )) {
        $booking = $booking.Replace(
            $importAnchor,
            $importAnchor +
            "`n" +
            'import BookingContactCard from "@/app/components/BookingContactCard";'
        )
    }

    $anchor =
        '              {booking.message && ('

    $anchorIndex = $booking.IndexOf($anchor)

    if ($anchorIndex -lt 0) {
        throw "Ancre booking.message introuvable."
    }

    $contactLines = @(
        "              {/* KLYX_SECURE_CONTACT_UI_12_68B */}"
        "              <BookingContactCard"
        "                bookingId={booking.id}"
        "                bookingStatus={booking.status}"
        "                otherName={otherName}"
        "              />"
        ""
    )

    $contactBlock =
        [string]::Join(
            "`n",
            $contactLines
        )

    $booking =
        $booking.Substring(0, $anchorIndex) +
        $contactBlock +
        $booking.Substring($anchorIndex)
}

# ============================================================
# VERIFY BEFORE WRITE
# ============================================================

if (-not $apiContent.Contains(
    "KLYX_SECURE_BOOKING_CONTACT_API_12_68B"
)) {
    throw "API marker absent."
}

if (-not $componentContent.Contains(
    "KLYX_BOOKING_CONTACT_CARD_12_68B"
)) {
    throw "Component marker absent."
}

if (-not $booking.Contains($marker)) {
    throw "Booking marker absent."
}

if (-not $apiContent.Contains(
    "booking.parent_id === profile.id"
)) {
    throw "Client authorization absent."
}

if (-not $apiContent.Contains(
    "providerId === profile.id"
)) {
    throw "Provider authorization absent."
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $apiPath,
    $componentPath,
    $bookingPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination (
                $path + ".bak-12-68b-" + $timestamp
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
    $bookingPath,
    $booking,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.68b APPLIQUE"
Write-Host "======================================"
Write-Host "API contact securisee creee."
Write-Host "Client et prestataire verifies."
Write-Host "Numero bloque avant acceptation."
Write-Host "Numero jamais expose publiquement."
Write-Host "Bouton Appeler ajoute."
Write-Host ""