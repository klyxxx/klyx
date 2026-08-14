$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiDir = Join-Path `
    $projectRoot `
    "app\api\profile\phone\privacy"

$apiPath = Join-Path `
    $apiDir `
    "route.ts"

$componentPath = Join-Path `
    $projectRoot `
    "app\settings\PhonePrivacyControls.tsx"

$settingsPath = Join-Path `
    $projectRoot `
    "app\settings\page.tsx"

Write-Host ""
Write-Host "KLYX 12.75 - Phone Privacy Controls"
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
# API PRIVACY
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
'// KLYX_PHONE_PRIVACY_API_12_75'
''
'type Visibility ='
'  | "private"'
'  | "transaction_participants";'
''
'type PrivacyBody = {'
'  visibility?: Visibility;'
'};'
''
'type PhonePrivacyRow = {'
'  phone_number: string | null;'
'  phone_verified_at: string | null;'
'  phone_visibility: string | null;'
'};'
''
'function normalizeVisibility('
'  value: string | null'
'): Visibility {'
'  return value === "private"'
'    ? "private"'
'    : "transaction_participants";'
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
'    const row = data as PhonePrivacyRow;'
''
'    return NextResponse.json({'
'      visibility:'
'        normalizeVisibility('
'          row.phone_visibility'
'        ),'
'      hasPhone: Boolean('
'        row.phone_number?.trim()'
'      ),'
'      verified: Boolean('
'        row.phone_verified_at'
'      ),'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Confidentialite telephone indisponible.";'
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
'      (await request.json()) as PrivacyBody;'
''
'    if ('
'      body.visibility !== "private" &&'
'      body.visibility !=='
'        "transaction_participants"'
'    ) {'
'      return NextResponse.json('
'        {'
'          error:'
'            "Option de confidentialite invalide.",'
'        },'
'        { status: 400 }'
'      );'
'    }'
''
'    const { data, error } ='
'      await supabaseAdmin'
'        .from("profiles")'
'        .update({'
'          phone_visibility:'
'            body.visibility,'
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
'    const row = data as PhonePrivacyRow;'
''
'    return NextResponse.json({'
'      saved: true,'
'      visibility:'
'        normalizeVisibility('
'          row.phone_visibility'
'        ),'
'      hasPhone: Boolean('
'        row.phone_number?.trim()'
'      ),'
'      verified: Boolean('
'        row.phone_verified_at'
'      ),'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Modification impossible.";'
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
# UI PRIVACY
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
'  EyeOff,'
'  LoaderCircle,'
'  ShieldCheck,'
'  Users,'
'} from "lucide-react";'
''
'import { supabase } from "@/lib/supabase";'
''
'// KLYX_PHONE_PRIVACY_UI_12_75'
''
'type Visibility ='
'  | "private"'
'  | "transaction_participants";'
''
'type PrivacyPayload = {'
'  visibility?: Visibility;'
'  hasPhone?: boolean;'
'  verified?: boolean;'
'  saved?: boolean;'
'  error?: string;'
'};'
''
'export default function PhonePrivacyControls() {'
'  const [visibility, setVisibility] ='
'    useState<Visibility>('
'      "transaction_participants"'
'    );'
''
'  const [hasPhone, setHasPhone] ='
'    useState(false);'
''
'  const [verified, setVerified] ='
'    useState(false);'
''
'  const [loading, setLoading] ='
'    useState(true);'
''
'  const [saving, setSaving] ='
'    useState<Visibility | null>(null);'
''
'  const [message, setMessage] ='
'    useState("");'
''
'  const [errorMessage, setErrorMessage] ='
'    useState("");'
''
'  const getToken = useCallback(async () => {'
'    const { data } ='
'      await supabase.auth.getSession();'
''
'    const token ='
'      data.session?.access_token;'
''
'    if (!token) {'
'      throw new Error('
'        "Session KLYX introuvable."'
'      );'
'    }'
''
'    return token;'
'  }, []);'
''
'  const loadPrivacy ='
'    useCallback(async () => {'
'      setLoading(true);'
''
'      try {'
'        const token = await getToken();'
''
'        const response = await fetch('
'          "/api/profile/phone/privacy",'
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
'          (await response.json()) as PrivacyPayload;'
''
'        if (!response.ok) {'
'          throw new Error('
'            result.error ||'
'              "Chargement impossible."'
'          );'
'        }'
''
'        setVisibility('
'          result.visibility ??'
'            "transaction_participants"'
'        );'
''
'        setHasPhone('
'          Boolean(result.hasPhone)'
'        );'
''
'        setVerified('
'          Boolean(result.verified)'
'        );'
'      } catch (error) {'
'        setErrorMessage('
'          error instanceof Error'
'            ? error.message'
'            : "Chargement impossible."'
'        );'
'      } finally {'
'        setLoading(false);'
'      }'
'    }, [getToken]);'
''
'  useEffect(() => {'
'    void loadPrivacy();'
'  }, [loadPrivacy]);'
''
'  async function changeVisibility('
'    nextVisibility: Visibility'
'  ) {'
'    if ('
'      nextVisibility === visibility'
'    ) {'
'      return;'
'    }'
''
'    setSaving(nextVisibility);'
'    setMessage("");'
'    setErrorMessage("");'
''
'    try {'
'      const token = await getToken();'
''
'      const response = await fetch('
'        "/api/profile/phone/privacy",'
'        {'
'          method: "PUT",'
'          headers: {'
'            "Content-Type":'
'              "application/json",'
'            Authorization:'
'              "Bearer " + token,'
'          },'
'          body: JSON.stringify({'
'            visibility: nextVisibility,'
'          }),'
'        }'
'      );'
''
'      const result ='
'        (await response.json()) as PrivacyPayload;'
''
'      if (!response.ok) {'
'        throw new Error('
'          result.error ||'
'            "Modification impossible."'
'        );'
'      }'
''
'      setVisibility('
'        result.visibility ??'
'          nextVisibility'
'      );'
''
'      setHasPhone('
'        Boolean(result.hasPhone)'
'      );'
''
'      setVerified('
'        Boolean(result.verified)'
'      );'
''
'      setMessage('
'        nextVisibility === "private"'
'          ? "Ton numero est maintenant prive."'
'          : "Le partage avec les participants de mission est active."'
'      );'
'    } catch (error) {'
'      setErrorMessage('
'        error instanceof Error'
'          ? error.message'
'          : "Modification impossible."'
'      );'
'    } finally {'
'      setSaving(null);'
'    }'
'  }'
''
'  if (loading) {'
'    return ('
'      <section className="mb-7 rounded-[30px] border border-border bg-card p-6">'
'        <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">'
'          <LoaderCircle'
'            size={19}'
'            className="animate-spin"'
'          />'
'          Chargement de la confidentialite...'
'        </div>'
'      </section>'
'    );'
'  }'
''
'  return ('
'    <section className="mb-7 rounded-[30px] border border-border bg-card p-6 sm:p-7">'
'      <div className="flex items-start gap-4">'
'        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">'
'          <ShieldCheck size={22} />'
'        </div>'
''
'        <div>'
'          <h2 className="text-xl font-black">'
'            Confidentialite du telephone'
'          </h2>'
''
'          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">'
'            Tu controles si ton numero peut etre revele aux personnes liees a une mission KLYX.'
'          </p>'
'        </div>'
'      </div>'
''
'      {!hasPhone && ('
'        <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">'
'          Ajoute d abord ton numero de telephone.'
'        </div>'
'      )}'
''
'      {hasPhone && !verified && ('
'        <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">'
'          Ton numero doit etre verifie par SMS avant tout partage.'
'        </div>'
'      )}'
''
'      <div className="mt-6 grid gap-3 lg:grid-cols-2">'
'        <button'
'          type="button"'
'          disabled={saving !== null}'
'          onClick={() =>'
'            void changeVisibility('
'              "transaction_participants"'
'            )'
'          }'
'          className={'
'            "flex min-h-28 items-start gap-4 rounded-2xl border p-5 text-left transition " +'
'            (visibility ==='
'            "transaction_participants"'
'              ? "border-violet-500 bg-violet-500/[0.07]"'
'              : "border-border bg-background hover:border-violet-500/40")'
'          }'
'        >'
'          <Users'
'            size={21}'
'            className="mt-0.5 shrink-0 text-violet-500"'
'          />'
''
'          <span>'
'            <span className="block font-black">'
'              Participants de mission'
'            </span>'
''
'            <span className="mt-1 block text-sm leading-6 text-muted-foreground">'
'              Ton numero peut etre revele uniquement a ton client ou prestataire autorise.'
'            </span>'
'          </span>'
'        </button>'
''
'        <button'
'          type="button"'
'          disabled={saving !== null}'
'          onClick={() =>'
'            void changeVisibility('
'              "private"'
'            )'
'          }'
'          className={'
'            "flex min-h-28 items-start gap-4 rounded-2xl border p-5 text-left transition " +'
'            (visibility === "private"'
'              ? "border-rose-500 bg-rose-500/[0.06]"'
'              : "border-border bg-background hover:border-rose-500/40")'
'          }'
'        >'
'          <EyeOff'
'            size={21}'
'            className="mt-0.5 shrink-0 text-rose-500"'
'          />'
''
'          <span>'
'            <span className="block font-black">'
'              Toujours prive'
'            </span>'
''
'            <span className="mt-1 block text-sm leading-6 text-muted-foreground">'
'              Ton numero ne peut plus etre revele dans aucune mission.'
'            </span>'
'          </span>'
'        </button>'
'      </div>'
''
'      {saving && ('
'        <div className="mt-4 flex items-center gap-2 text-sm font-bold text-muted-foreground">'
'          <LoaderCircle'
'            size={16}'
'            className="animate-spin"'
'          />'
'          Enregistrement...'
'        </div>'
'      )}'
''
'      {message && ('
'        <div className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">'
'          {message}'
'        </div>'
'      )}'
''
'      {errorMessage && ('
'        <div className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">'
'          {errorMessage}'
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

$marker =
    "KLYX_PHONE_PRIVACY_SETTINGS_12_75"

$privacyImport =
    'import PhonePrivacyControls from "./PhonePrivacyControls";'

if (-not $settings.Contains(
    $privacyImport
)) {
    $phoneImport =
        'import PhoneSettingsInline from "./PhoneSettingsInline";'

    if (-not $settings.Contains(
        $phoneImport
    )) {
        throw "Import PhoneSettingsInline introuvable."
    }

    $settings =
        $settings.Replace(
            $phoneImport,
            $phoneImport +
            "`n" +
            $privacyImport
        )
}

if (-not $settings.Contains($marker)) {
    $phoneAnchor =
        "          <PhoneSettingsInline />"

    if (-not $settings.Contains(
        $phoneAnchor
    )) {
        $phoneAnchor =
            "      <PhoneSettingsInline />"
    }

    if (-not $settings.Contains(
        $phoneAnchor
    )) {
        throw "PhoneSettingsInline visible introuvable."
    }

    $indent = ""

    if ($phoneAnchor.StartsWith(
        "          "
    )) {
        $indent = "          "
    }
    else {
        $indent = "      "
    }

    $privacyBlock =
        $phoneAnchor +
        "`n" +
        $indent +
        "{/* KLYX_PHONE_PRIVACY_SETTINGS_12_75 */}" +
        "`n" +
        $indent +
        "<PhonePrivacyControls />"

    $settings =
        $settings.Replace(
            $phoneAnchor,
            $privacyBlock
        )
}

# ============================================================
# VALIDATION
# ============================================================

$checks = @(
    @{
        Name = "privacy API"
        Value = $apiContent.Contains(
            "KLYX_PHONE_PRIVACY_API_12_75"
        )
    },
    @{
        Name = "private visibility"
        Value = $apiContent.Contains(
            '"private"'
        )
    },
    @{
        Name = "participants visibility"
        Value = $apiContent.Contains(
            '"transaction_participants"'
        )
    },
    @{
        Name = "privacy UI"
        Value = $componentContent.Contains(
            "KLYX_PHONE_PRIVACY_UI_12_75"
        )
    },
    @{
        Name = "settings integration"
        Value = $settings.Contains(
            "KLYX_PHONE_PRIVACY_SETTINGS_12_75"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.75 validation failed : $($check.Name)"
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
                ".bak-12-75-" +
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
Write-Host "KLYX 12.75 APPLIQUE"
Write-Host "======================================"
Write-Host "Confidentialite telephone ajoutee."
Write-Host "Mode participants disponible."
Write-Host "Mode toujours prive disponible."
Write-Host "Changement effectif immediatement."
Write-Host ""