$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$migrationsDir = Join-Path $projectRoot "supabase\migrations"

$migrationPath = Join-Path `
    $migrationsDir `
    "20260812182000_klyx_phone_otp_security_12_71.sql"

$sendPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\otp\send\route.ts"

$verifyPath = Join-Path `
    $projectRoot `
    "app\api\profile\phone\otp\verify\route.ts"

Write-Host ""
Write-Host "KLYX 12.71 - Persistent OTP Security"
Write-Host ""

foreach ($path in @(
    $sendPath,
    $verifyPath
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
# 1. MIGRATION SUPABASE
# ============================================================

$migrationLines = @(
'-- KLYX_PHONE_OTP_SECURITY_12_71'
''
'create table if not exists public.phone_verification_limits ('
'  profile_id uuid primary key references public.profiles(id) on delete cascade,'
'  last_sent_at timestamptz,'
'  failed_attempts integer not null default 0,'
'  locked_until timestamptz,'
'  updated_at timestamptz not null default now()'
');'
''
'alter table public.phone_verification_limits'
'  enable row level security;'
''
'revoke all on table public.phone_verification_limits'
'  from anon, authenticated;'
''
'create index if not exists phone_verification_limits_locked_until_idx'
'  on public.phone_verification_limits (locked_until);'
''
'comment on table public.phone_verification_limits is'
'  ''KLYX server-only OTP anti-abuse state.'';'
)

$migrationContent =
    [string]::Join(
        "`n",
        $migrationLines
    )

# ============================================================
# 2. SEND OTP API
# ============================================================

$sendLines = @(
'import { NextResponse } from "next/server";'
''
'import {'
'  apiErrorStatus,'
'  getAuthenticatedProfile,'
'} from "@/lib/api-auth";'
'import { supabaseAdmin } from "@/lib/supabase-admin";'
'import { sendPhoneOtp } from "@/lib/twilio-verify";'
''
'// KLYX_PHONE_OTP_SEND_SECURITY_12_71'
''
'type PhoneRow = {'
'  phone_number: string | null;'
'  phone_verified_at: string | null;'
'};'
''
'type LimitRow = {'
'  profile_id: string;'
'  last_sent_at: string | null;'
'  failed_attempts: number;'
'  locked_until: string | null;'
'};'
''
'const SEND_COOLDOWN_SECONDS = 60;'
''
'function secondsUntil(value: string) {'
'  return Math.max('
'    1,'
'    Math.ceil('
'      (new Date(value).getTime() - Date.now()) /'
'        1000'
'    )'
'  );'
'}'
''
'function maskPhone(value: string) {'
'  if (value.length <= 6) return value;'
''
'  return ('
'    value.slice(0, 4) +'
'    "****" +'
'    value.slice(-3)'
'  );'
'}'
''
'export async function POST(request: Request) {'
'  try {'
'    const { profile } ='
'      await getAuthenticatedProfile(request);'
''
'    const { data: phoneData, error: phoneError } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .select("phone_number, phone_verified_at")'
'        .eq("id", profile.id)'
'        .single();'
''
'    if (phoneError) {'
'      throw new Error(phoneError.message);'
'    }'
''
'    const phone = phoneData as PhoneRow;'
''
'    const phoneNumber ='
'      phone.phone_number?.trim() ?? "";'
''
'    if (!phoneNumber) {'
'      return NextResponse.json('
'        {'
'          error:'
'            "Enregistre ton numero avant de demander un code.",'
'        },'
'        { status: 400 }'
'      );'
'    }'
''
'    if (phone.phone_verified_at) {'
'      return NextResponse.json({'
'        sent: false,'
'        alreadyVerified: true,'
'        verified: true,'
'      });'
'    }'
''
'    const { data: limitData, error: limitError } ='
'      await supabaseAdmin'
'        .from("phone_verification_limits")'
'        .select('
'          "profile_id, last_sent_at, failed_attempts, locked_until"'
'        )'
'        .eq("profile_id", profile.id)'
'        .maybeSingle();'
''
'    if (limitError) {'
'      throw new Error(limitError.message);'
'    }'
''
'    const limits ='
'      limitData as LimitRow | null;'
''
'    if ('
'      limits?.locked_until &&'
'      new Date(limits.locked_until).getTime() >'
'        Date.now()'
'    ) {'
'      return NextResponse.json('
'        {'
'          error:'
'            "Verification temporairement bloquee apres plusieurs codes incorrects.",'
'          retryAfter: secondsUntil('
'            limits.locked_until'
'          ),'
'        },'
'        { status: 429 }'
'      );'
'    }'
''
'    if (limits?.last_sent_at) {'
'      const elapsedSeconds ='
'        (Date.now() -'
'          new Date('
'            limits.last_sent_at'
'          ).getTime()) /'
'        1000;'
''
'      if ('
'        elapsedSeconds <'
'        SEND_COOLDOWN_SECONDS'
'      ) {'
'        return NextResponse.json('
'          {'
'            error:'
'              "Attends avant de demander un nouveau code.",'
'            retryAfter: Math.ceil('
'              SEND_COOLDOWN_SECONDS -'
'                elapsedSeconds'
'            ),'
'          },'
'          { status: 429 }'
'        );'
'      }'
'    }'
''
'    const sentAt ='
'      new Date().toISOString();'
''
'    const { error: claimError } ='
'      await supabaseAdmin'
'        .from("phone_verification_limits")'
'        .upsert('
'          {'
'            profile_id: profile.id,'
'            last_sent_at: sentAt,'
'            updated_at: sentAt,'
'          },'
'          {'
'            onConflict: "profile_id",'
'          }'
'        );'
''
'    if (claimError) {'
'      throw new Error(claimError.message);'
'    }'
''
'    await sendPhoneOtp(phoneNumber);'
''
'    return NextResponse.json({'
'      sent: true,'
'      verified: false,'
'      maskedPhone: maskPhone(phoneNumber),'
'      retryAfter: SEND_COOLDOWN_SECONDS,'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Envoi du code impossible.";'
''
'    return NextResponse.json('
'      { error: message },'
'      { status: apiErrorStatus(message) }'
'    );'
'  }'
'}'
)

$sendContent =
    [string]::Join(
        "`n",
        $sendLines
    )

# ============================================================
# 3. VERIFY OTP API
# ============================================================

$verifyLines = @(
'import { NextResponse } from "next/server";'
''
'import {'
'  apiErrorStatus,'
'  getAuthenticatedProfile,'
'} from "@/lib/api-auth";'
'import { supabaseAdmin } from "@/lib/supabase-admin";'
'import { verifyPhoneOtp } from "@/lib/twilio-verify";'
''
'// KLYX_PHONE_OTP_VERIFY_SECURITY_12_71'
''
'type VerifyBody = {'
'  code?: string;'
'};'
''
'type PhoneRow = {'
'  phone_number: string | null;'
'  phone_verified_at: string | null;'
'};'
''
'type LimitRow = {'
'  failed_attempts: number;'
'  locked_until: string | null;'
'};'
''
'const MAX_FAILED_ATTEMPTS = 5;'
'const LOCK_MINUTES = 15;'
''
'function secondsUntil(value: string) {'
'  return Math.max('
'    1,'
'    Math.ceil('
'      (new Date(value).getTime() - Date.now()) /'
'        1000'
'    )'
'  );'
'}'
''
'export async function POST(request: Request) {'
'  try {'
'    const { profile } ='
'      await getAuthenticatedProfile(request);'
''
'    const body ='
'      (await request.json()) as VerifyBody;'
''
'    const code ='
'      body.code?.trim() ?? "";'
''
'    if (!/^\d{4,10}$/.test(code)) {'
'      return NextResponse.json('
'        { error: "Code OTP invalide." },'
'        { status: 400 }'
'      );'
'    }'
''
'    const { data: phoneData, error: phoneError } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .select("phone_number, phone_verified_at")'
'        .eq("id", profile.id)'
'        .single();'
''
'    if (phoneError) {'
'      throw new Error(phoneError.message);'
'    }'
''
'    const phone = phoneData as PhoneRow;'
''
'    const phoneNumber ='
'      phone.phone_number?.trim() ?? "";'
''
'    if (!phoneNumber) {'
'      return NextResponse.json('
'        { error: "Numero KLYX introuvable." },'
'        { status: 400 }'
'      );'
'    }'
''
'    if (phone.phone_verified_at) {'
'      return NextResponse.json({'
'        verified: true,'
'        alreadyVerified: true,'
'        verifiedAt:'
'          phone.phone_verified_at,'
'      });'
'    }'
''
'    const { data: limitData, error: limitError } ='
'      await supabaseAdmin'
'        .from("phone_verification_limits")'
'        .select("failed_attempts, locked_until")'
'        .eq("profile_id", profile.id)'
'        .maybeSingle();'
''
'    if (limitError) {'
'      throw new Error(limitError.message);'
'    }'
''
'    const limits ='
'      limitData as LimitRow | null;'
''
'    if ('
'      limits?.locked_until &&'
'      new Date(limits.locked_until).getTime() >'
'        Date.now()'
'    ) {'
'      return NextResponse.json('
'        {'
'          error:'
'            "Trop de codes incorrects. Reessaie plus tard.",'
'          retryAfter: secondsUntil('
'            limits.locked_until'
'          ),'
'        },'
'        { status: 429 }'
'      );'
'    }'
''
'    const result ='
'      await verifyPhoneOtp('
'        phoneNumber,'
'        code'
'      );'
''
'    if (!result.approved) {'
'      const failedAttempts ='
'        (limits?.failed_attempts ?? 0) + 1;'
''
'      const shouldLock ='
'        failedAttempts >='
'        MAX_FAILED_ATTEMPTS;'
''
'      const lockedUntil = shouldLock'
'        ? new Date('
'            Date.now() +'
'              LOCK_MINUTES * 60 * 1000'
'          ).toISOString()'
'        : null;'
''
'      const now = new Date().toISOString();'
''
'      const { error: failureError } ='
'        await supabaseAdmin'
'          .from("phone_verification_limits")'
'          .upsert('
'            {'
'              profile_id: profile.id,'
'              failed_attempts:'
'                failedAttempts,'
'              locked_until:'
'                lockedUntil,'
'              updated_at: now,'
'            },'
'            {'
'              onConflict: "profile_id",'
'            }'
'          );'
''
'      if (failureError) {'
'        throw new Error('
'          failureError.message'
'        );'
'      }'
''
'      if (shouldLock && lockedUntil) {'
'        return NextResponse.json('
'          {'
'            error:'
'              "Trop de codes incorrects. Verification bloquee pendant 15 minutes.",'
'            retryAfter: secondsUntil('
'              lockedUntil'
'            ),'
'          },'
'          { status: 429 }'
'        );'
'      }'
''
'      return NextResponse.json('
'        {'
'          error: "Code incorrect ou expire.",'
'          attemptsRemaining: Math.max('
'            0,'
'            MAX_FAILED_ATTEMPTS -'
'              failedAttempts'
'          ),'
'        },'
'        { status: 400 }'
'      );'
'    }'
''
'    const verifiedAt ='
'      new Date().toISOString();'
''
'    const { data: updated, error: updateError } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .update({'
'          phone_verified_at:'
'            verifiedAt,'
'        })'
'        .eq("id", profile.id)'
'        .eq("phone_number", phoneNumber)'
'        .select('
'          "phone_number, phone_verified_at"'
'        )'
'        .maybeSingle();'
''
'    if (updateError) {'
'      throw new Error(updateError.message);'
'    }'
''
'    if (!updated) {'
'      return NextResponse.json('
'        {'
'          error:'
'            "Le numero a change pendant la verification.",'
'        },'
'        { status: 409 }'
'      );'
'    }'
''
'    const { error: resetError } ='
'      await supabaseAdmin'
'        .from("phone_verification_limits")'
'        .upsert('
'          {'
'            profile_id: profile.id,'
'            failed_attempts: 0,'
'            locked_until: null,'
'            updated_at: verifiedAt,'
'          },'
'          {'
'            onConflict: "profile_id",'
'          }'
'        );'
''
'    if (resetError) {'
'      throw new Error(resetError.message);'
'    }'
''
'    return NextResponse.json({'
'      verified: true,'
'      verifiedAt,'
'      phoneNumber,'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Verification impossible.";'
''
'    return NextResponse.json('
'      { error: message },'
'      { status: apiErrorStatus(message) }'
'    );'
'  }'
'}'
)

$verifyContent =
    [string]::Join(
        "`n",
        $verifyLines
    )

# ============================================================
# 4. VERIFY BEFORE WRITE
# ============================================================

$checks = @(
    @{
        Name = "migration"
        Value = $migrationContent.Contains(
            "KLYX_PHONE_OTP_SECURITY_12_71"
        )
    },
    @{
        Name = "send security"
        Value = $sendContent.Contains(
            "KLYX_PHONE_OTP_SEND_SECURITY_12_71"
        )
    },
    @{
        Name = "send cooldown"
        Value = $sendContent.Contains(
            "SEND_COOLDOWN_SECONDS = 60"
        )
    },
    @{
        Name = "verify security"
        Value = $verifyContent.Contains(
            "KLYX_PHONE_OTP_VERIFY_SECURITY_12_71"
        )
    },
    @{
        Name = "max attempts"
        Value = $verifyContent.Contains(
            "MAX_FAILED_ATTEMPTS = 5"
        )
    },
    @{
        Name = "lock time"
        Value = $verifyContent.Contains(
            "LOCK_MINUTES = 15"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.71 validation failed : $($check.Name)"
    }
}

# ============================================================
# 5. BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $migrationPath,
    $sendPath,
    $verifyPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination (
                $path +
                ".bak-12-71-" +
                $timestamp
            ) `
            -Force
    }
}

# ============================================================
# 6. WRITE
# ============================================================

[System.IO.File]::WriteAllText(
    $migrationPath,
    $migrationContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $sendPath,
    $sendContent,
    $utf8NoBom
)

[System.IO.File]::WriteAllText(
    $verifyPath,
    $verifyContent,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.71 APPLIQUE"
Write-Host "======================================"
Write-Host "Cooldown SMS persistant."
Write-Host "5 erreurs maximum."
Write-Host "Blocage 15 minutes."
Write-Host "Etat stocke dans Supabase."
Write-Host ""