$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$migrationsDir = Join-Path `
    $projectRoot `
    "supabase\migrations"

$apiDir = Join-Path `
    $projectRoot `
    "app\api\profile\phone"

$pageDir = Join-Path `
    $projectRoot `
    "app\settings\phone"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $migrationsDir |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $apiDir |
    Out-Null

New-Item `
    -ItemType Directory `
    -Force `
    -Path $pageDir |
    Out-Null

$migrationPath = Join-Path `
    $migrationsDir `
    "20260812154600_klyx_phone_12_67.sql"

$apiPath = Join-Path `
    $apiDir `
    "route.ts"

$pagePath = Join-Path `
    $pageDir `
    "page.tsx"

Write-Host ""
Write-Host "KLYX 12.67 - Secure Phone Foundation"
Write-Host ""

# ============================================================
# SQL MIGRATION
# ============================================================

$migrationLines = @(
    "-- KLYX_PHONE_FOUNDATION_12_67"
    ""
    "alter table public.profiles"
    "  add column if not exists phone_number text;"
    ""
    "alter table public.profiles"
    "  add column if not exists phone_verified_at timestamptz;"
    ""
    "alter table public.profiles"
    "  add column if not exists phone_visibility text"
    "  not null default 'transaction_participants';"
    ""
    "do `$`$"
    "begin"
    "  if not exists ("
    "    select 1"
    "    from pg_constraint"
    "    where conname = 'profiles_phone_visibility_check'"
    "  ) then"
    "    alter table public.profiles"
    "      add constraint profiles_phone_visibility_check"
    "      check ("
    "        phone_visibility in ("
    "          'private',"
    "          'transaction_participants'"
    "        )"
    "      );"
    "  end if;"
    "end"
    "`$`$;"
    ""
    "comment on column public.profiles.phone_number is"
    "  'Numero de telephone KLYX au format international E.164.';"
    ""
    "comment on column public.profiles.phone_verified_at is"
    "  'Date de verification OTP du numero de telephone.';"
    ""
    "comment on column public.profiles.phone_visibility is"
    "  'Controle la visibilite du numero. Jamais public par defaut.';"
)

$migrationContent =
    [string]::Join(
        "`n",
        $migrationLines
    )

# ============================================================
# API
# ============================================================

$apiLines = @(
    'import { NextResponse } from "next/server";'
    'import { supabaseAdmin } from "@/lib/supabase-admin";'
    'import {'
    '  apiErrorStatus,'
    '  getAuthenticatedProfile,'
    '} from "@/lib/api-auth";'
    ''
    '// KLYX_PHONE_API_12_67'
    ''
    'type PhoneBody = {'
    '  phoneNumber?: string | null;'
    '};'
    ''
    'type PhoneRow = {'
    '  phone_number: string | null;'
    '  phone_verified_at: string | null;'
    '  phone_visibility: string | null;'
    '};'
    ''
    'function normalizePhone('
    '  value: string | null | undefined'
    '): string | null {'
    '  if (value == null) return null;'
    ''
    '  let cleaned = value'
    '    .trim()'
    '    .replace(/[()\s.\-]/g, "");'
    ''
    '  if (!cleaned) return null;'
    ''
    '  if (cleaned.startsWith("00")) {'
    '    cleaned = "+" + cleaned.slice(2);'
    '  }'
    ''
    '  return cleaned;'
    '}'
    ''
    'function isValidInternationalPhone('
    '  value: string'
    ') {'
    '  return /^\+[1-9]\d{7,14}$/.test(value);'
    '}'
    ''
    'export async function GET(request: Request) {'
    '  try {'
    '    const { profile } ='
    '      await getAuthenticatedProfile(request);'
    ''
    '    const { data, error } ='
    '      await supabaseAdmin'
    '        .from("profiles")'
    '        .select('
    '          "phone_number, phone_verified_at, phone_visibility"'
    '        )'
    '        .eq("id", profile.id)'
    '        .single();'
    ''
    '    if (error) {'
    '      throw new Error(error.message);'
    '    }'
    ''
    '    const row = data as PhoneRow;'
    ''
    '    return NextResponse.json({'
    '      phoneNumber: row.phone_number,'
    '      verified: Boolean('
    '        row.phone_verified_at'
    '      ),'
    '      verifiedAt:'
    '        row.phone_verified_at,'
    '      visibility:'
    '        row.phone_visibility ??'
    '        "transaction_participants",'
    '    });'
    '  } catch (error) {'
    '    const message ='
    '      error instanceof Error'
    '        ? error.message'
    '        : "Telephone KLYX indisponible.";'
    ''
    '    return NextResponse.json('
    '      { error: message },'
    '      { status: apiErrorStatus(message) }'
    '    );'
    '  }'
    '}'
    ''
    'export async function PUT(request: Request) {'
    '  try {'
    '    const { profile } ='
    '      await getAuthenticatedProfile(request);'
    ''
    '    const body ='
    '      (await request.json()) as PhoneBody;'
    ''
    '    const phoneNumber ='
    '      normalizePhone(body.phoneNumber);'
    ''
    '    if ('
    '      phoneNumber &&'
    '      !isValidInternationalPhone(phoneNumber)'
    '    ) {'
    '      return NextResponse.json('
    '        {'
    '          error:'
    '            "Utilise un numero international, par exemple +32471503513.",'
    '        },'
    '        { status: 400 }'
    '      );'
    '    }'
    ''
    '    const { data, error } ='
    '      await supabaseAdmin'
    '        .from("profiles")'
    '        .update({'
    '          phone_number: phoneNumber,'
    '          phone_verified_at: null,'
    '          phone_visibility:'
    '            "transaction_participants",'
    '        })'
    '        .eq("id", profile.id)'
    '        .select('
    '          "phone_number, phone_verified_at, phone_visibility"'
    '        )'
    '        .single();'
    ''
    '    if (error) {'
    '      throw new Error(error.message);'
    '    }'
    ''
    '    const row = data as PhoneRow;'
    ''
    '    return NextResponse.json({'
    '      saved: true,'
    '      phoneNumber: row.phone_number,'
    '      verified: false,'
    '      verifiedAt: null,'
    '      visibility:'
    '        row.phone_visibility ??'
    '        "transaction_participants",'
    '    });'
    '  } catch (error) {'
    '    const message ='
    '      error instanceof Error'
    '        ? error.message'
    '        : "Enregistrement du telephone impossible.";'
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
# PAGE /settings/phone
# ============================================================

$pageLines = @(
    '"use client";'
    ''
    'import {'
    '  useEffect,'
    '  useMemo,'
    '  useState,'
    '} from "react";'
    'import Link from "next/link";'
    'import { createBrowserClient } from "@supabase/ssr";'
    'import {'
    '  ArrowLeft,'
    '  CheckCircle2,'
    '  LoaderCircle,'
    '  LockKeyhole,'
    '  Phone,'
    '  Save,'
    '  ShieldCheck,'
    '} from "lucide-react";'
    ''
    '// KLYX_PHONE_SETTINGS_12_67'
    ''
    'type PhonePayload = {'
    '  phoneNumber?: string | null;'
    '  verified?: boolean;'
    '  verifiedAt?: string | null;'
    '  visibility?: string;'
    '  saved?: boolean;'
    '  error?: string;'
    '};'
    ''
    'export default function PhoneSettingsPage() {'
    '  const supabase = useMemo(() => {'
    '    const url ='
    '      process.env.NEXT_PUBLIC_SUPABASE_URL;'
    ''
    '    const key ='
    '      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??'
    '      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;'
    ''
    '    if (!url || !key) {'
    '      throw new Error('
    '        "Configuration Supabase publique manquante."'
    '      );'
    '    }'
    ''
    '    return createBrowserClient(url, key);'
    '  }, []);'
    ''
    '  const [phoneNumber, setPhoneNumber] ='
    '    useState("");'
    ''
    '  const [verified, setVerified] ='
    '    useState(false);'
    ''
    '  const [loading, setLoading] ='
    '    useState(true);'
    ''
    '  const [saving, setSaving] ='
    '    useState(false);'
    ''
    '  const [message, setMessage] ='
    '    useState("");'
    ''
    '  const [errorMessage, setErrorMessage] ='
    '    useState("");'
    ''
    '  async function accessToken() {'
    '    const {'
    '      data: { session },'
    '    } = await supabase.auth.getSession();'
    ''
    '    return session?.access_token ?? null;'
    '  }'
    ''
    '  useEffect(() => {'
    '    let active = true;'
    ''
    '    async function loadPhone() {'
    '      try {'
    '        const token = await accessToken();'
    ''
    '        if (!token) {'
    '          if (active) {'
    '            setErrorMessage('
    '              "Connecte-toi pour gerer ton numero."'
    '            );'
    '          }'
    ''
    '          return;'
    '        }'
    ''
    '        const response = await fetch('
    '          "/api/profile/phone",'
    '          {'
    '            cache: "no-store",'
    '            headers: {'
    '              Authorization:'
    '                "Bearer " + token,'
    '            },'
    '          }'
    '        );'
    ''
    '        const body ='
    '          (await response.json()) as PhonePayload;'
    ''
    '        if (!response.ok) {'
    '          throw new Error('
    '            body.error ||'
    '              "Impossible de charger le numero."'
    '          );'
    '        }'
    ''
    '        if (!active) return;'
    ''
    '        setPhoneNumber('
    '          body.phoneNumber ?? ""'
    '        );'
    ''
    '        setVerified('
    '          Boolean(body.verified)'
    '        );'
    '      } catch (error) {'
    '        if (!active) return;'
    ''
    '        setErrorMessage('
    '          error instanceof Error'
    '            ? error.message'
    '            : "Chargement impossible."'
    '        );'
    '      } finally {'
    '        if (active) {'
    '          setLoading(false);'
    '        }'
    '      }'
    '    }'
    ''
    '    void loadPhone();'
    ''
    '    return () => {'
    '      active = false;'
    '    };'
    '  }, [supabase]);'
    ''
    '  async function savePhone() {'
    '    setSaving(true);'
    '    setMessage("");'
    '    setErrorMessage("");'
    ''
    '    try {'
    '      const token = await accessToken();'
    ''
    '      if (!token) {'
    '        throw new Error('
    '          "Session KLYX introuvable."'
    '        );'
    '      }'
    ''
    '      const response = await fetch('
    '        "/api/profile/phone",'
    '        {'
    '          method: "PUT",'
    '          headers: {'
    '            "Content-Type":'
    '              "application/json",'
    '            Authorization:'
    '              "Bearer " + token,'
    '          },'
    '          body: JSON.stringify({'
    '            phoneNumber,'
    '          }),'
    '        }'
    '      );'
    ''
    '      const body ='
    '        (await response.json()) as PhonePayload;'
    ''
    '      if (!response.ok) {'
    '        throw new Error('
    '          body.error ||'
    '            "Enregistrement impossible."'
    '        );'
    '      }'
    ''
    '      setPhoneNumber('
    '        body.phoneNumber ?? ""'
    '      );'
    ''
    '      setVerified(false);'
    ''
    '      setMessage('
    '        body.phoneNumber'
    '          ? "Numero enregistre."'
    '          : "Numero supprime."'
    '      );'
    '    } catch (error) {'
    '      setErrorMessage('
    '        error instanceof Error'
    '          ? error.message'
    '          : "Enregistrement impossible."'
    '      );'
    '    } finally {'
    '      setSaving(false);'
    '    }'
    '  }'
    ''
    '  return ('
    '    <main className="klyx-page">'
    '      <div className="mx-auto max-w-2xl">'
    '        <Link'
    '          href="/settings"'
    '          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"'
    '        >'
    '          <ArrowLeft size={17} />'
    '          Parametres'
    '        </Link>'
    ''
    '        <section className="klyx-card mt-6 p-6 sm:p-8">'
    '          <div className="flex items-start gap-4">'
    '            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">'
    '              <Phone size={22} />'
    '            </div>'
    ''
    '            <div>'
    '              <p className="klyx-eyebrow">'
    '                Telephone KLYX'
    '              </p>'
    ''
    '              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">'
    '                Ton numero de telephone'
    '              </h1>'
    ''
    '              <p className="mt-3 text-sm leading-7 text-muted-foreground">'
    '                Ajoute un numero pour pouvoir communiquer avec la personne liee a une mission KLYX.'
    '              </p>'
    '            </div>'
    '          </div>'
    ''
    '          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-4">'
    '            <div className="flex gap-3">'
    '              <ShieldCheck'
    '                size={20}'
    '                className="mt-0.5 shrink-0 text-emerald-600"'
    '              />'
    ''
    '              <div>'
    '                <p className="font-black">'
    '                  Numero prive'
    '                </p>'
    ''
    '                <p className="mt-1 text-sm leading-6 text-muted-foreground">'
    '                  Ton numero ne sera jamais affiche publiquement sur ton profil KLYX. Il pourra etre partage uniquement avec la personne concernee par une transaction autorisee.'
    '                </p>'
    '              </div>'
    '            </div>'
    '          </div>'
    ''
    '          {loading ? ('
    '            <div className="mt-8 flex items-center gap-3 text-sm font-bold text-muted-foreground">'
    '              <LoaderCircle'
    '                size={20}'
    '                className="animate-spin"'
    '              />'
    '              Chargement...'
    '            </div>'
    '          ) : ('
    '            <>'
    '              <label className="mt-8 block">'
    '                <span className="text-sm font-black">'
    '                  Numero international'
    '                </span>'
    ''
    '                <input'
    '                  type="tel"'
    '                  inputMode="tel"'
    '                  autoComplete="tel"'
    '                  placeholder="+32471503513"'
    '                  value={phoneNumber}'
    '                  onChange={(event) => {'
    '                    setPhoneNumber('
    '                      event.target.value'
    '                    );'
    '                    setMessage("");'
    '                  }}'
    '                  className="mt-2 h-13 w-full rounded-2xl border border-border bg-background px-4 text-base font-semibold outline-none transition focus:border-violet-500"'
    '                />'
    '              </label>'
    ''
    '              <p className="mt-2 text-xs leading-5 text-muted-foreground">'
    '                Exemple Belgique : +32 471 50 35 13'
    '              </p>'
    ''
    '              <div className="mt-5 flex items-center gap-2 text-sm">'
    '                {verified ? ('
    '                  <>'
    '                    <CheckCircle2'
    '                      size={18}'
    '                      className="text-emerald-600"'
    '                    />'
    '                    <span className="font-bold text-emerald-700 dark:text-emerald-300">'
    '                      Numero verifie'
    '                    </span>'
    '                  </>'
    '                ) : ('
    '                  <>'
    '                    <LockKeyhole'
    '                      size={18}'
    '                      className="text-muted-foreground"'
    '                    />'
    '                    <span className="font-semibold text-muted-foreground">'
    '                      Verification OTP a venir'
    '                    </span>'
    '                  </>'
    '                )}'
    '              </div>'
    ''
    '              {message && ('
    '                <p className="mt-5 rounded-2xl bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">'
    '                  {message}'
    '                </p>'
    '              )}'
    ''
    '              {errorMessage && ('
    '                <p className="mt-5 rounded-2xl bg-rose-500/10 p-4 text-sm font-bold text-rose-700 dark:text-rose-300">'
    '                  {errorMessage}'
    '                </p>'
    '              )}'
    ''
    '              <button'
    '                type="button"'
    '                disabled={saving}'
    '                onClick={() => {'
    '                  void savePhone();'
    '                }}'
    '                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"'
    '              >'
    '                {saving ? ('
    '                  <LoaderCircle'
    '                    size={18}'
    '                    className="animate-spin"'
    '                  />'
    '                ) : ('
    '                  <Save size={18} />'
    '                )}'
    ''
    '                Enregistrer'
    '              </button>'
    '            </>'
    '          )}'
    '        </section>'
    '      </div>'
    '    </main>'
    '  );'
    '}'
)

$pageContent =
    [string]::Join(
        "`n",
        $pageLines
    )

# ============================================================
# VERIFICATIONS AVANT ECRITURE
# ============================================================

$checks = @(
    @{
        Name = "migration marker"
        Value = $migrationContent.Contains(
            "KLYX_PHONE_FOUNDATION_12_67"
        )
    },
    @{
        Name = "phone_number"
        Value = $migrationContent.Contains(
            "phone_number"
        )
    },
    @{
        Name = "phone private"
        Value = $migrationContent.Contains(
            "transaction_participants"
        )
    },
    @{
        Name = "API marker"
        Value = $apiContent.Contains(
            "KLYX_PHONE_API_12_67"
        )
    },
    @{
        Name = "auth API"
        Value = $apiContent.Contains(
            "getAuthenticatedProfile"
        )
    },
    @{
        Name = "phone validation"
        Value = $apiContent.Contains(
            "isValidInternationalPhone"
        )
    },
    @{
        Name = "settings marker"
        Value = $pageContent.Contains(
            "KLYX_PHONE_SETTINGS_12_67"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "Verification 12.67 echouee : $($check.Name)"
    }
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

$backupItems = @()

foreach ($path in @(
    $migrationPath,
    $apiPath,
    $pagePath
)) {
    if (Test-Path -LiteralPath $path) {
        $backup =
            "$path.bak-12-67-$timestamp"

        Copy-Item `
            -LiteralPath $path `
            -Destination $backup `
            -Force

        $backupItems += @{
            Path = $path
            Backup = $backup
        }
    }
}

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

try {
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
        $pagePath,
        $pageContent,
        $utf8NoBom
    )
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant KLYX 12.67."
    Write-Host "Restauration..."

    foreach ($item in $backupItems) {
        Copy-Item `
            -LiteralPath $item.Backup `
            -Destination $item.Path `
            -Force
    }

    throw
}

Write-Host ""
Write-Host "OK - KLYX 12.67 applique."
Write-Host "OK - telephone ajoute aux profils."
Write-Host "OK - client et prestataire compatibles."
Write-Host "OK - numero non public."
Write-Host "OK - API telephone authentifiee."
Write-Host "OK - page /settings/phone creee."
Write-Host ""
Write-Host "Migration creee :"
Write-Host $migrationPath
Write-Host ""