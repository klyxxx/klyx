$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiDir = Join-Path `
    $projectRoot `
    "app\api\brain\command"

$apiPath = Join-Path `
    $apiDir `
    "route.ts"

$commandPath = Join-Path `
    $projectRoot `
    "app\components\AssistantCommandBar.tsx"

$assistantPath = Join-Path `
    $projectRoot `
    "app\assistant\page.tsx"

Write-Host ""
Write-Host "KLYX 12.80 - Server Smart Command Router"
Write-Host ""

foreach ($path in @(
    $commandPath,
    $assistantPath
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

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

# ============================================================
# SERVER COMMAND ROUTER
# ============================================================

$apiLines = @(
'import { NextResponse } from "next/server";'
'import {'
'  apiErrorStatus,'
'  getAuthenticatedProfile,'
'} from "@/lib/api-auth";'
''
'// KLYX_SERVER_COMMAND_ROUTER_12_80'
''
'type ActionKind ='
'  | "compare_offers"'
'  | "finalize_booking"'
'  | "payment_pending"'
'  | "track_mission"'
'  | "confirm_completion"'
'  | "review_completed"'
'  | "provider_offer_update"'
'  | "provider_booking_request"'
'  | "provider_track_mission"'
'  | "provider_finish_mission";'
''
'type CommandAction = {'
'  id: string;'
'  kind: ActionKind;'
'  priority: number;'
'  title: string;'
'  description: string;'
'  href: string;'
'  label: string;'
'};'
''
'type CommandBody = {'
'  message?: string;'
'  actions?: unknown;'
'};'
''
'const ALLOWED_KINDS = new Set<ActionKind>(['
'  "compare_offers",'
'  "finalize_booking",'
'  "payment_pending",'
'  "track_mission",'
'  "confirm_completion",'
'  "review_completed",'
'  "provider_offer_update",'
'  "provider_booking_request",'
'  "provider_track_mission",'
'  "provider_finish_mission",'
']);'
''
'function normalize(value: string) {'
'  return value'
'    .toLowerCase()'
'    .normalize("NFD")'
'    .replace(/\p{Diacritic}/gu, "")'
'    .replace(/[^a-z0-9\s]/g, " ")'
'    .replace(/\s+/g, " ")'
'    .trim();'
'}'
''
'function includesAny('
'  value: string,'
'  expressions: string[]'
') {'
'  return expressions.some((expression) =>'
'    value.includes(expression)'
'  );'
'}'
''
'function isAllowedHref(value: string) {'
'  return ('
'    value === "/bookings" ||'
'    value === "/assistant/actions" ||'
'    value.startsWith("/bookings/") ||'
'    value.startsWith("/tracking/") ||'
'    value.startsWith("/assistant/market/") ||'
'    value.startsWith("/quotes/")'
'  );'
'}'
''
'function sanitizeAction('
'  value: unknown'
'): CommandAction | null {'
'  if (!value || typeof value !== "object") {'
'    return null;'
'  }'
''
'  const item = value as Record<string, unknown>;'
''
'  if ('
'    typeof item.id !== "string" ||'
'    typeof item.kind !== "string" ||'
'    typeof item.priority !== "number" ||'
'    typeof item.title !== "string" ||'
'    typeof item.description !== "string" ||'
'    typeof item.href !== "string" ||'
'    typeof item.label !== "string"'
'  ) {'
'    return null;'
'  }'
''
'  if (!ALLOWED_KINDS.has(item.kind as ActionKind)) {'
'    return null;'
'  }'
''
'  if (!isAllowedHref(item.href)) {'
'    return null;'
'  }'
''
'  return {'
'    id: item.id.slice(0, 200),'
'    kind: item.kind as ActionKind,'
'    priority: Math.max('
'      0,'
'      Math.min(1000, item.priority)'
'    ),'
'    title: item.title.slice(0, 200),'
'    description: item.description.slice(0, 500),'
'    href: item.href,'
'    label: item.label.slice(0, 120),'
'  };'
'}'
''
'function sanitizeActions(value: unknown) {'
'  if (!Array.isArray(value)) {'
'    return [] as CommandAction[];'
'  }'
''
'  return value'
'    .slice(0, 20)'
'    .map(sanitizeAction)'
'    .filter('
'      (item): item is CommandAction =>'
'        item !== null'
'    );'
'}'
''
'function actionIntentScore('
'  action: CommandAction,'
'  message: string'
') {'
'  let score = action.priority;'
''
'  if ('
'    action.kind === "payment_pending" &&'
'    includesAny(message, ['
'      "payer",'
'      "paiement",'
'      "payement",'
'      "regler",'
'      "carte bancaire",'
'    ])'
'  ) {'
'    score += 2000;'
'  }'
''
'  if ('
'    ('
'      action.kind === "track_mission" ||'
'      action.kind ==='
'        "provider_track_mission"'
'    ) &&'
'    includesAny(message, ['
'      "suivre",'
'      "suivi",'
'      "ou en est",'
'      "ou est le prestataire",'
'      "prestataire en route",'
'      "prestataire arrive",'
'      "etat de la mission",'
'      "etat de la prestation",'
'    ])'
'  ) {'
'    score += 1900;'
'  }'
''
'  if ('
'    action.kind === "confirm_completion" &&'
'    includesAny(message, ['
'      "confirmer la fin",'
'      "confirmer mission",'
'      "confirmer la mission",'
'      "mission terminee",'
'      "prestation terminee",'
'      "travail termine",'
'    ])'
'  ) {'
'    score += 2100;'
'  }'
''
'  if ('
'    action.kind ==='
'      "provider_finish_mission" &&'
'    includesAny(message, ['
'      "declarer la fin",'
'      "terminer la mission",'
'      "finir la mission",'
'      "mission finie",'
'      "travail fini",'
'    ])'
'  ) {'
'    score += 2100;'
'  }'
''
'  if ('
'    action.kind ==='
'      "provider_booking_request" &&'
'    includesAny(message, ['
'      "nouvelle reservation",'
'      "demande client",'
'      "accepter la reservation",'
'      "refuser la reservation",'
'      "repondre au client",'
'    ])'
'  ) {'
'    score += 1900;'
'  }'
''
'  if ('
'    action.kind === "compare_offers" &&'
'    includesAny(message, ['
'      "comparer les offres",'
'      "voir les offres",'
'      "choisir une offre",'
'      "choisir prestataire",'
'    ])'
'  ) {'
'    score += 1800;'
'  }'
''
'  if ('
'    action.kind === "finalize_booking" &&'
'    includesAny(message, ['
'      "finaliser la reservation",'
'      "choisir le creneau",'
'      "confirmer le creneau",'
'    ])'
'  ) {'
'    score += 1800;'
'  }'
''
'  if ('
'    action.kind === "review_completed" &&'
'    includesAny(message, ['
'      "laisser un avis",'
'      "donner mon avis",'
'      "noter le prestataire",'
'    ])'
'  ) {'
'    score += 1700;'
'  }'
''
'  return score;'
'}'
''
'function hasSpecificExistingIntent(message: string) {'
'  return includesAny(message, ['
'    "payer",'
'    "paiement",'
'    "payement",'
'    "regler",'
'    "suivre",'
'    "suivi",'
'    "ou en est",'
'    "ou est le prestataire",'
'    "confirmer la fin",'
'    "confirmer mission",'
'    "mission terminee",'
'    "prestation terminee",'
'    "declarer la fin",'
'    "terminer la mission",'
'    "finir la mission",'
'    "nouvelle reservation",'
'    "demande client",'
'    "comparer les offres",'
'    "voir les offres",'
'    "choisir une offre",'
'    "finaliser la reservation",'
'    "choisir le creneau",'
'    "laisser un avis",'
'    "donner mon avis",'
'  ]);'
'}'
''
'function hasGeneralActionIntent(message: string) {'
'  return includesAny(message, ['
'    "que dois je faire",'
'    "quoi faire maintenant",'
'    "prochaine action",'
'    "prochaine etape",'
'    "quelle est la suite",'
'    "continuer ma demande",'
'    "reprendre ma demande",'
'    "mes actions",'
'    "ma priorite",'
'  ]);'
'}'
''
'function hasNewNeedIntent(message: string) {'
'  return includesAny(message, ['
'    "j ai besoin de",'
'    "je cherche",'
'    "trouve moi",'
'    "trouver quelqu un",'
'    "cherche quelqu un",'
'    "besoin d un",'
'    "besoin d une",'
'    "je voudrais un",'
'    "je voudrais une",'
'  ]);'
'}'
''
'function bestAction('
'  actions: CommandAction[],'
'  message: string'
') {'
'  if (actions.length === 0) {'
'    return null;'
'  }'
''
'  const ranked = [...actions].sort('
'    (first, second) =>'
'      actionIntentScore(second, message) -'
'      actionIntentScore(first, message)'
'  );'
''
'  return ranked[0] ?? null;'
'}'
''
'export async function POST(request: Request) {'
'  try {'
'    await getAuthenticatedProfile(request);'
''
'    const body ='
'      (await request.json()) as CommandBody;'
''
'    const rawMessage ='
'      body.message?.trim() ?? "";'
''
'    if (!rawMessage) {'
'      return NextResponse.json('
'        { error: "Message manquant." },'
'        { status: 400 }'
'      );'
'    }'
''
'    if (rawMessage.length > 700) {'
'      return NextResponse.json('
'        { error: "Message trop long." },'
'        { status: 400 }'
'      );'
'    }'
''
'    const message = normalize(rawMessage);'
'    const actions = sanitizeActions(body.actions);'
''
'    const specificExistingIntent ='
'      hasSpecificExistingIntent(message);'
''
'    const generalActionIntent ='
'      hasGeneralActionIntent(message);'
''
'    const newNeedIntent ='
'      hasNewNeedIntent(message);'
''
'    if ('
'      actions.length > 0 &&'
'      ('
'        specificExistingIntent ||'
'        generalActionIntent'
'      )'
'    ) {'
'      const action ='
'        bestAction(actions, message);'
''
'      if (action) {'
'        return NextResponse.json({'
'          mode: "existing_action",'
'          requiresConfirmation: false,'
'          automaticExecutionAllowed: false,'
'          action,'
'        });'
'      }'
'    }'
''
'    if (newNeedIntent || !generalActionIntent) {'
'      const params = new URLSearchParams();'
'      params.set("request", rawMessage);'
''
'      return NextResponse.json({'
'        mode: "new_request",'
'        requiresConfirmation: true,'
'        automaticExecutionAllowed: false,'
'        href:'
'          "/assistant/market?" +'
'          params.toString(),'
'      });'
'    }'
''
'    return NextResponse.json({'
'      mode: "no_action",'
'      requiresConfirmation: false,'
'      automaticExecutionAllowed: false,'
'      href: "/assistant/actions",'
'    });'
'  } catch (error) {'
'    const message ='
'      error instanceof Error'
'        ? error.message'
'        : "Commande KLYX indisponible.";'
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
# COMMAND BAR COMPLETE
# ============================================================

$commandLines = @(
'"use client";'
''
'import {'
'  FormEvent,'
'  useMemo,'
'  useState,'
'} from "react";'
'import {'
'  ArrowRight,'
'  Camera,'
'  CheckCircle2,'
'  CreditCard,'
'  LoaderCircle,'
'  Navigation,'
'  Sparkles,'
'} from "lucide-react";'
'import { useRouter } from "next/navigation";'
'import { supabase } from "@/lib/supabase";'
''
'// KLYX_SERVER_COMMAND_UI_12_80'
''
'type AssistantAction = {'
'  id: string;'
'  kind: string;'
'  priority: number;'
'  title: string;'
'  description: string;'
'  href: string;'
'  label: string;'
'};'
''
'type Props = {'
'  actions?: AssistantAction[];'
'};'
''
'type CommandResponse = {'
'  mode?:'
'    | "existing_action"'
'    | "new_request"'
'    | "no_action";'
'  href?: string;'
'  action?: AssistantAction;'
'  error?: string;'
'  automaticExecutionAllowed?: false;'
'};'
''
'const EXAMPLES = ['
'  "J ai besoin d un plombier demain a Bruxelles",'
'  "Que dois je faire maintenant ?",'
'  "Ou en est ma mission ?",'
'];'
''
'function ActionIcon({ kind }: { kind: string }) {'
'  if (kind === "payment_pending") {'
'    return <CreditCard size={15} />;'
'  }'
''
'  if ('
'    kind === "track_mission" ||'
'    kind === "provider_track_mission"'
'  ) {'
'    return <Navigation size={15} />;'
'  }'
''
'  if ('
'    kind === "confirm_completion" ||'
'    kind === "provider_finish_mission"'
'  ) {'
'    return <CheckCircle2 size={15} />;'
'  }'
''
'  return <Sparkles size={15} />;'
'}'
''
'export default function AssistantCommandBar({'
'  actions = [],'
'}: Props) {'
'  const router = useRouter();'
''
'  const [value, setValue] = useState("");'
'  const [busy, setBusy] = useState(false);'
'  const [errorMessage, setErrorMessage] ='
'    useState("");'
''
'  const suggestedActions = useMemo('
'    () => actions.slice(0, 3),'
'    [actions]'
'  );'
''
'  async function submit(event: FormEvent) {'
'    event.preventDefault();'
''
'    const message = value.trim();'
''
'    if (!message || busy) return;'
''
'    setBusy(true);'
'    setErrorMessage("");'
''
'    try {'
'      const {'
'        data: { session },'
'      } = await supabase.auth.getSession();'
''
'      if (!session?.access_token) {'
'        router.push("/login");'
'        return;'
'      }'
''
'      const response = await fetch('
'        "/api/brain/command",'
'        {'
'          method: "POST",'
'          headers: {'
'            "Content-Type":'
'              "application/json",'
'            Authorization:'
'              "Bearer " +'
'              session.access_token,'
'          },'
'          body: JSON.stringify({'
'            message,'
'            actions,'
'          }),'
'        }'
'      );'
''
'      const result ='
'        (await response.json()) as CommandResponse;'
''
'      if (!response.ok) {'
'        throw new Error('
'          result.error ||'
'            "KLYX ne peut pas traiter cette commande."'
'        );'
'      }'
''
'      if ('
'        result.mode === "existing_action" &&'
'        result.action?.href'
'      ) {'
'        router.push(result.action.href);'
'        return;'
'      }'
''
'      if (result.href) {'
'        router.push(result.href);'
'        return;'
'      }'
''
'      router.push("/assistant/actions");'
'    } catch (error) {'
'      setErrorMessage('
'        error instanceof Error'
'          ? error.message'
'          : "Commande KLYX indisponible."'
'      );'
'      setBusy(false);'
'    }'
'  }'
''
'  return ('
'    <section className="mt-7">'
'      <form'
'        onSubmit={submit}'
'        className="rounded-[28px] border border-border bg-card p-2 shadow-sm"'
'      >'
'        <div className="flex items-center gap-3 px-3 pt-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">'
'          <Sparkles'
'            size={15}'
'            className="text-violet-600 dark:text-violet-400"'
'          />'
'          Demande a KLYX'
'        </div>'
''
'        <div className="mt-1 flex flex-col gap-2 sm:flex-row">'
'          <textarea'
'            value={value}'
'            onChange={(event) =>'
'              setValue(event.target.value)'
'            }'
'            rows={2}'
'            maxLength={700}'
'            placeholder="Nouveau besoin ou prochaine action, ecris simplement ce que tu veux faire..."'
'            className="min-h-[74px] flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"'
'          />'
''
'          <div className="flex items-end gap-2">'
'            <button'
'              type="button"'
'              onClick={() =>'
'                router.push("/request/photo")'
'              }'
'              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted"'
'            >'
'              <Camera size={18} />'
'              <span className="hidden md:inline">'
'                Photo'
'              </span>'
'            </button>'
''
'            <button'
'              type="submit"'
'              disabled={!value.trim() || busy}'
'              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"'
'            >'
'              {busy ? ('
'                <LoaderCircle'
'                  size={18}'
'                  className="animate-spin"'
'                />'
'              ) : ('
'                <ArrowRight size={18} />'
'              )}'
'              Continuer'
'            </button>'
'          </div>'
'        </div>'
'      </form>'
''
'      {errorMessage && ('
'        <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-300">'
'          {errorMessage}'
'        </div>'
'      )}'
''
'      {suggestedActions.length > 0 && ('
'        <div className="mt-3">'
'          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">'
'            Actions detectees'
'          </p>'
''
'          <div className="flex flex-wrap gap-2">'
'            {suggestedActions.map((action) => ('
'              <button'
'                key={action.id}'
'                type="button"'
'                onClick={() =>'
'                  router.push(action.href)'
'                }'
'                className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"'
'              >'
'                <ActionIcon'
'                  kind={action.kind}'
'                />'
'                {action.label}'
'              </button>'
'            ))}'
'          </div>'
'        </div>'
'      )}'
''
'      <div className="mt-3 flex flex-wrap gap-2">'
'        {EXAMPLES.map((example) => ('
'          <button'
'            key={example}'
'            type="button"'
'            onClick={() => setValue(example)}'
'            className="rounded-full border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"'
'          >'
'            {example}'
'          </button>'
'        ))}'
'      </div>'
'    </section>'
'  );'
'}'
)

$commandContent =
    [string]::Join(
        "`n",
        $commandLines
    )

# ============================================================
# VALIDATION
# ============================================================

$assistant =
    [System.IO.File]::ReadAllText(
        $assistantPath
    )

$checks = @(
    @{
        Name = "server router"
        Value = $apiContent.Contains(
            "KLYX_SERVER_COMMAND_ROUTER_12_80"
        )
    },
    @{
        Name = "authenticated route"
        Value = $apiContent.Contains(
            "getAuthenticatedProfile(request)"
        )
    },
    @{
        Name = "existing action mode"
        Value = $apiContent.Contains(
            '"existing_action"'
        )
    },
    @{
        Name = "new request mode"
        Value = $apiContent.Contains(
            '"new_request"'
        )
    },
    @{
        Name = "no automatic execution"
        Value = $apiContent.Contains(
            "automaticExecutionAllowed: false"
        )
    },
    @{
        Name = "safe internal href"
        Value = $apiContent.Contains(
            "isAllowedHref"
        )
    },
    @{
        Name = "UI server command"
        Value = $commandContent.Contains(
            "KLYX_SERVER_COMMAND_UI_12_80"
        )
    },
    @{
        Name = "command API call"
        Value = $commandContent.Contains(
            '"/api/brain/command"'
        )
    },
    @{
        Name = "assistant passes actions"
        Value = $assistant.Contains(
            "actions={data?.actions ?? []}"
        )
    }
)

foreach ($check in $checks) {
    if (-not $check.Value) {
        throw "12.80 validation failed : $($check.Name)"
    }
}

# ============================================================
# BACKUPS
# ============================================================

$timestamp =
    Get-Date -Format "yyyyMMdd-HHmmss"

foreach ($path in @(
    $apiPath,
    $commandPath
)) {
    if (Test-Path -LiteralPath $path) {
        Copy-Item `
            -LiteralPath $path `
            -Destination (
                $path +
                ".bak-12-80-" +
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
    $commandPath,
    $commandContent,
    $utf8NoBom
)

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.80 APPLIQUE"
Write-Host "======================================"
Write-Host "Routeur assistant cote serveur."
Write-Host "Actions existantes distinguees."
Write-Host "Nouveaux besoins distingues."
Write-Host "Aucune execution sensible automatique."
Write-Host ""