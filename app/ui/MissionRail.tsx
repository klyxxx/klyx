"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  History,
  LogOut,
  Plus,
  Settings,
  WalletCards,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AccountSwitcher from "@/app/components/AccountSwitcher";
import KlyxLogo from "@/app/ui/KlyxLogo";
import { createClient } from "@/lib/supabase/client";

type AccountType = "client" | "provider";
type MissionRole = "client" | "provider";

type MissionCard = {
  id: string;
  entityType: "booking" | "group";
  href: string;
  role?: MissionRole;
  otherUserName: string;
  serviceLabel: string;
  statusLabel: string;
  dateFrom: string;
  actionRequired: boolean;
  history: boolean;
  createdAt: string;
};

type SplitMission = {
  id: string;
  status: string;
  serviceName: string;
  firstDate: string | null;
  createdAt: string;
  actionRequired: boolean;
};

type RailMission = {
  key: string;
  href: string;
  title: string;
  statusLabel: string;
  when: string;
  roleLabel: string;
  otherUserName: string;
  createdAt: string;
  actionRequired: boolean;
  history: boolean;
};

type HiddenEntity = {
  entityType: "booking" | "group" | "split";
  entityId: string;
};

type Copy = {
  newMission: string;
  history: string;
  current: string;
  recent: string;
  emptyCurrent: string;
  emptyRecent: string;
  emptyHistory: string;
  account: string;
  profile: string;
  settings: string;
  manageProfiles: string;
  commercialProfile: string;
  services: string;
  finances: string;
  logout: string;
  loggingOut: string;
  collapse: string;
  expand: string;
  clientRole: string;
  providerRole: string;
};

const RAIL_COLLAPSED_STORAGE_KEY = "klyx:mission-rail:collapsed";

const COPY: Record<string, Copy> = {
  fr: {
    newMission: "Nouvelle mission",
    history: "Historique",
    current: "En cours",
    recent: "Récentes",
    emptyCurrent: "Aucune mission en cours",
    emptyRecent: "Aucune mission récente",
    emptyHistory: "Aucune mission",
    account: "Compte",
    profile: "Profil",
    settings: "Paramètres",
    manageProfiles: "Gérer les profils",
    commercialProfile: "Fiche commerciale",
    services: "Services",
    finances: "Finances",
    logout: "Déconnexion",
    loggingOut: "Déconnexion…",
    collapse: "Replier le rail",
    expand: "Déplier le rail",
    clientRole: "Client",
    providerRole: "Prestataire",
  },
  en: {
    newMission: "New mission",
    history: "History",
    current: "In progress",
    recent: "Recent",
    emptyCurrent: "No mission in progress",
    emptyRecent: "No recent mission",
    emptyHistory: "No mission",
    account: "Account",
    profile: "Profile",
    settings: "Settings",
    manageProfiles: "Manage profiles",
    commercialProfile: "Business profile",
    services: "Services",
    finances: "Finances",
    logout: "Log out",
    loggingOut: "Logging out…",
    collapse: "Collapse rail",
    expand: "Expand rail",
    clientRole: "Client",
    providerRole: "Provider",
  },
  nl: {
    newMission: "Nieuwe missie",
    history: "Geschiedenis",
    current: "Bezig",
    recent: "Recent",
    emptyCurrent: "Geen lopende missie",
    emptyRecent: "Geen recente missie",
    emptyHistory: "Geen missie",
    account: "Account",
    profile: "Profiel",
    settings: "Instellingen",
    manageProfiles: "Profielen beheren",
    commercialProfile: "Bedrijfsprofiel",
    services: "Diensten",
    finances: "Financiën",
    logout: "Uitloggen",
    loggingOut: "Uitloggen…",
    collapse: "Rail inklappen",
    expand: "Rail uitklappen",
    clientRole: "Klant",
    providerRole: "Aanbieder",
  },
  de: {
    newMission: "Neue Mission",
    history: "Verlauf",
    current: "Laufend",
    recent: "Kürzlich",
    emptyCurrent: "Keine laufende Mission",
    emptyRecent: "Keine kürzliche Mission",
    emptyHistory: "Keine Mission",
    account: "Konto",
    profile: "Profil",
    settings: "Einstellungen",
    manageProfiles: "Profile verwalten",
    commercialProfile: "Geschäftsprofil",
    services: "Services",
    finances: "Finanzen",
    logout: "Abmelden",
    loggingOut: "Abmeldung…",
    collapse: "Leiste einklappen",
    expand: "Leiste ausklappen",
    clientRole: "Kunde",
    providerRole: "Anbieter",
  },
  es: {
    newMission: "Nueva misión",
    history: "Historial",
    current: "En curso",
    recent: "Recientes",
    emptyCurrent: "No hay misiones en curso",
    emptyRecent: "No hay misiones recientes",
    emptyHistory: "No hay misiones",
    account: "Cuenta",
    profile: "Perfil",
    settings: "Ajustes",
    manageProfiles: "Gestionar perfiles",
    commercialProfile: "Perfil comercial",
    services: "Servicios",
    finances: "Finanzas",
    logout: "Cerrar sesión",
    loggingOut: "Cerrando sesión…",
    collapse: "Contraer panel",
    expand: "Expandir panel",
    clientRole: "Cliente",
    providerRole: "Proveedor",
  },
};

const SPLIT_STATUS: Record<string, Record<string, string>> = {
  fr: {
    requested: "Demandée",
    pending: "En attente",
    accepted: "Acceptée",
    confirmed: "Confirmée",
    rejected: "Refusée",
    cancelled: "Annulée",
    completed: "Terminée",
  },
  en: {
    requested: "Requested",
    pending: "Pending",
    accepted: "Accepted",
    confirmed: "Confirmed",
    rejected: "Rejected",
    cancelled: "Cancelled",
    completed: "Completed",
  },
  nl: {
    requested: "Aangevraagd",
    pending: "In afwachting",
    accepted: "Geaccepteerd",
    confirmed: "Bevestigd",
    rejected: "Geweigerd",
    cancelled: "Geannuleerd",
    completed: "Voltooid",
  },
  de: {
    requested: "Angefragt",
    pending: "Ausstehend",
    accepted: "Akzeptiert",
    confirmed: "Bestätigt",
    rejected: "Abgelehnt",
    cancelled: "Storniert",
    completed: "Abgeschlossen",
  },
  es: {
    requested: "Solicitada",
    pending: "Pendiente",
    accepted: "Aceptada",
    confirmed: "Confirmada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
    completed: "Completada",
  },
};

function copyFor(locale: string) {
  return COPY[locale] ?? COPY.en;
}

function hiddenKey(entityType: HiddenEntity["entityType"], entityId: string) {
  return `${entityType}:${entityId}`;
}

function dateTimeLabel(locale: string, value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const hasExplicitTime = /T\d{2}:\d{2}|\s\d{1,2}:\d{2}/.test(value);

  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(hasExplicitTime
        ? { hour: "2-digit", minute: "2-digit" }
        : {}),
    }).format(date);
  } catch {
    return value;
  }
}

function missionRoleLabel(locale: string, role: MissionRole | undefined) {
  if (!role) return "";
  const copy = copyFor(locale);
  return role === "provider" ? copy.providerRole : copy.clientRole;
}

function splitStatusLabel(locale: string, status: string) {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "";
  return SPLIT_STATUS[locale]?.[normalized] ?? SPLIT_STATUS.en[normalized] ?? status;
}

function compareMissions(left: RailMission, right: RailMission) {
  if (left.actionRequired !== right.actionRequired) {
    return Number(right.actionRequired) - Number(left.actionRequired);
  }
  return right.createdAt.localeCompare(left.createdAt);
}

function normalizePath(value: string) {
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function hrefForMission(mission: MissionCard) {
  if (mission.href) return mission.href;
  return mission.entityType === "booking"
    ? `/bookings/${mission.id}`
    : `/booking-groups/${mission.id}`;
}

function railMissionFromCard(locale: string, mission: MissionCard): RailMission {
  return {
    key: `${mission.entityType}:${mission.id}`,
    href: hrefForMission(mission),
    title: mission.serviceLabel || mission.otherUserName || "KLYX",
    statusLabel: mission.statusLabel.trim(),
    when: dateTimeLabel(locale, mission.dateFrom),
    roleLabel: missionRoleLabel(locale, mission.role),
    otherUserName: mission.otherUserName.trim(),
    createdAt: mission.createdAt,
    actionRequired: mission.actionRequired,
    history: mission.history,
  };
}

function missionMeta(mission: RailMission, siblings: RailMission[]) {
  const sameFingerprint = siblings.filter(
    (candidate) =>
      candidate.key !== mission.key &&
      candidate.title === mission.title &&
      candidate.statusLabel === mission.statusLabel &&
      candidate.when === mission.when &&
      candidate.roleLabel === mission.roleLabel
  );
  const nameDistinguishes =
    Boolean(mission.otherUserName) &&
    sameFingerprint.some(
      (candidate) =>
        Boolean(candidate.otherUserName) &&
        candidate.otherUserName !== mission.otherUserName
    );

  return [
    mission.statusLabel,
    mission.when,
    mission.roleLabel,
    nameDistinguishes ? mission.otherUserName : "",
  ]
    .filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index)
    .join(" · ");
}

async function bearerToken() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function MissionRail({
  accountType,
  activeProfileId,
  homeHref,
  locale,
  mobile = false,
  onNavigate,
}: {
  accountType: AccountType | null;
  activeProfileId: string | null;
  homeHref: string;
  locale: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const copy = copyFor(locale);
  const [collapsed, setCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [missions, setMissions] = useState<RailMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const compact = !mobile && collapsed;
  const currentPath = normalizePath(pathname || "/");

  useEffect(() => {
    if (mobile) return;

    try {
      const stored = window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setCollapsed(stored === "true");
      }
    } catch {
      // The rail remains expanded when storage is unavailable.
    }
  }, [mobile]);

  useEffect(() => {
    let cancelled = false;

    async function loadMissions() {
      if (!accountType) {
        setMissions([]);
        return;
      }

      setLoading(true);

      try {
        const token = await bearerToken();
        if (!token) throw new Error("session unavailable");
        const headers = { Authorization: `Bearer ${token}` };

        if (accountType === "provider") {
          const response = await fetch("/api/provider/jobs", {
            cache: "no-store",
            headers,
          });
          if (!response.ok) throw new Error("provider missions unavailable");

          const body = (await response.json()) as {
            confirmedMissions?: MissionCard[];
          };
          const next = (body.confirmedMissions ?? [])
            .filter((mission) => mission.role !== "client")
            .map((mission) => railMissionFromCard(locale, mission))
            .sort(compareMissions);

          if (!cancelled) setMissions(next);
          return;
        }

        const [overviewResponse, hiddenResponse, splitResponse] = await Promise.all([
          fetch("/api/bookings/overview", { cache: "no-store", headers }),
          fetch("/api/bookings/activity-hidden", { cache: "no-store", headers }),
          fetch("/api/bookings/split-missions", { cache: "no-store", headers }),
        ]);

        if (!overviewResponse.ok || !hiddenResponse.ok) {
          throw new Error("client missions unavailable");
        }

        const overview = (await overviewResponse.json()) as { cards?: MissionCard[] };
        const hidden = (await hiddenResponse.json()) as {
          ok?: boolean;
          hidden?: HiddenEntity[];
        };
        const split = splitResponse.ok
          ? ((await splitResponse.json()) as {
              missions?: SplitMission[];
              childBookingIds?: string[];
            })
          : { missions: [], childBookingIds: [] };

        if (hidden.ok !== true || !Array.isArray(hidden.hidden)) {
          throw new Error("hidden missions unavailable");
        }

        const removed = new Set(
          hidden.hidden.map((item) => hiddenKey(item.entityType, item.entityId))
        );
        const splitChildren = new Set(split.childBookingIds ?? []);

        const standard = (overview.cards ?? [])
          .filter(
            (mission) =>
              !removed.has(hiddenKey(mission.entityType, mission.id)) &&
              !splitChildren.has(mission.id)
          )
          .map((mission) => railMissionFromCard(locale, mission));

        const splitMissions = (split.missions ?? [])
          .filter((mission) => !removed.has(hiddenKey("split", mission.id)))
          .map<RailMission>((mission) => ({
            key: `split:${mission.id}`,
            href: "/bookings",
            title: mission.serviceName || "KLYX",
            statusLabel: splitStatusLabel(locale, mission.status),
            when: dateTimeLabel(locale, mission.firstDate),
            roleLabel: missionRoleLabel(locale, "client"),
            otherUserName: "",
            createdAt: mission.createdAt,
            actionRequired: mission.actionRequired,
            history: mission.status === "completed" || mission.status === "cancelled",
          }));

        if (!cancelled) {
          setMissions([...standard, ...splitMissions].sort(compareMissions));
        }
      } catch {
        if (!cancelled) setMissions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMissions();
    return () => {
      cancelled = true;
    };
  }, [accountType, activeProfileId, locale]);

  const currentMissions = useMemo(
    () => missions.filter((mission) => !mission.history),
    [missions]
  );
  const recentMissions = useMemo(
    () => missions.filter((mission) => mission.history),
    [missions]
  );
  const pinnedMissions = useMemo(() => {
    const active = missions.find(
      (mission) => normalizePath(mission.href) === currentPath
    );
    if (active) return [active];

    const actionRequired = currentMissions.find((mission) => mission.actionRequired);
    return actionRequired ? [actionRequired] : [];
  }, [currentMissions, currentPath, missions]);

  function setCollapsedPreference(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // Persistence is optional; never block the rail interaction.
    }
  }

  function openAccountFromCompactRail() {
    setCollapsedPreference(false);
    setAccountOpen(true);
  }

  function openHistoryFromCompactRail() {
    setCollapsedPreference(false);
    setHistoryOpen(true);
  }

  function isMissionActive(mission: RailMission) {
    return normalizePath(mission.href) === currentPath;
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  function missionRow(mission: RailMission, siblings: RailMission[]) {
    const active = isMissionActive(mission);
    const meta = missionMeta(mission, siblings);
    const Icon = mission.history ? History : Clock3;

    return (
      <Link
        key={mission.key}
        href={mission.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={meta ? `${mission.title} — ${meta}` : mission.title}
        data-testid="mission-history-row"
        className={`group relative flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
          active ? "bg-[#2563EB]/10" : "hover:bg-muted"
        }`}
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#2563EB]"
          />
        )}
        <Icon
          size={15}
          className={
            active
              ? "shrink-0 text-[#2563EB]"
              : "shrink-0 text-muted-foreground"
          }
        />
        <span
          className={`min-w-0 flex-1 truncate text-[13px] font-medium leading-5 ${
            active ? "text-[#2563EB]" : "text-foreground"
          }`}
        >
          {mission.title}
        </span>
        {mission.actionRequired && (
          <span
            aria-label={copy.newMission}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]"
          />
        )}
        {meta && (
          <span className="max-w-[44%] shrink truncate text-[11px] leading-5 text-muted-foreground">
            {meta}
          </span>
        )}
      </Link>
    );
  }

  function historySection(label: string, empty: string, rows: RailMission[]) {
    return (
      <section aria-label={label}>
        <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        {rows.length === 0 ? (
          <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
            {empty}
          </p>
        ) : (
          <div className="space-y-0.5">
            {rows.map((mission) => missionRow(mission, rows))}
          </div>
        )}
      </section>
    );
  }

  return (
    <aside
      data-testid={mobile ? "mobile-mission-rail" : "desktop-mission-rail"}
      className={
        mobile
          ? "flex h-full w-full flex-col bg-background"
          : `sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 lg:flex dark:border-white/8 ${
              compact ? "w-[76px]" : "w-[256px]"
            }`
      }
    >
      <div className="px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <KlyxLogo href={homeHref} compact={compact} />
          {!mobile && (
            <button
              type="button"
              onClick={() => setCollapsedPreference(!collapsed)}
              aria-label={compact ? copy.expand : copy.collapse}
              title={compact ? copy.expand : copy.collapse}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {compact ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
          )}
        </div>

        <a
          href={homeHref}
          onClick={onNavigate}
          aria-label={copy.newMission}
          title={copy.newMission}
          data-testid="new-mission-action"
          className="mt-4 inline-grid h-10 w-10 place-items-center rounded-full bg-[#2563EB] text-white transition hover:opacity-90"
        >
          <Plus size={19} />
        </a>
      </div>

      <div
        className={
          compact
            ? "min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2"
            : "min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2"
        }
      >
        {!compact &&
          pinnedMissions.map((mission) => missionRow(mission, pinnedMissions))}

        {compact ? (
          <button
            type="button"
            onClick={openHistoryFromCompactRail}
            aria-label={copy.history}
            title={copy.history}
            data-testid="mission-history-entry"
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <History size={17} />
          </button>
        ) : (
          <details
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            data-testid="mission-history"
            className="group"
          >
            <summary
              data-testid="mission-history-entry"
              className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-foreground transition hover:bg-muted"
            >
              <History size={16} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{copy.history}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {loading ? "…" : missions.length}
              </span>
              <ChevronRight
                size={14}
                className="shrink-0 text-muted-foreground transition group-open:rotate-90"
              />
            </summary>

            <div
              data-testid="mission-history-detail"
              className="mt-2 space-y-4 pb-2"
            >
              {loading ? (
                <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
                  KLYX…
                </p>
              ) : missions.length === 0 ? (
                <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
                  {copy.emptyHistory}
                </p>
              ) : (
                <>
                  {historySection(copy.current, copy.emptyCurrent, currentMissions)}
                  {historySection(copy.recent, copy.emptyRecent, recentMissions)}
                </>
              )}
            </div>
          </details>
        )}
      </div>

      <div
        className={
          compact
            ? "border-t border-border px-4 py-4 dark:border-white/8"
            : "border-t border-border px-3 py-4 dark:border-white/8"
        }
      >
        {compact ? (
          <button
            type="button"
            onClick={openAccountFromCompactRail}
            aria-label={copy.account}
            title={copy.account}
            data-testid="account-entry"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CircleUserRound size={20} />
          </button>
        ) : (
          <details
            open={accountOpen}
            onToggle={(event) => setAccountOpen(event.currentTarget.open)}
            className="group"
          >
            <summary
              data-testid="account-entry"
              className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              <CircleUserRound size={17} className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{copy.account}</span>
              <ChevronRight
                size={15}
                className="shrink-0 text-muted-foreground transition group-open:rotate-90"
              />
            </summary>

            <div className="mt-1 space-y-1 pl-1">
              {activeProfileId && (
                <div
                  data-testid="account-profile-switcher"
                  className="pb-1 [&>div>button]:min-h-12 [&>div>button]:rounded-lg [&>div>button]:bg-background"
                >
                  <AccountSwitcher currentProfileId={activeProfileId} />
                </div>
              )}

              <Link
                href="/profile"
                onClick={onNavigate}
                className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <CircleUserRound size={15} />
                {copy.profile}
              </Link>

              {accountType === "provider" && (
                <>
                  <Link
                    href="/provider"
                    onClick={onNavigate}
                    className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <BriefcaseBusiness size={15} />
                    {copy.commercialProfile}
                  </Link>
                  <Link
                    href="/provider/studio"
                    onClick={onNavigate}
                    className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Wrench size={15} />
                    {copy.services}
                  </Link>
                  <Link
                    href="/provider/payments"
                    onClick={onNavigate}
                    className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <WalletCards size={15} />
                    {copy.finances}
                  </Link>
                </>
              )}

              <Link
                href="/settings"
                onClick={onNavigate}
                className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Settings size={15} />
                {copy.settings}
              </Link>
              <Link
                href="/accounts"
                onClick={onNavigate}
                className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <CircleUserRound size={15} />
                {copy.manageProfiles}
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
              >
                <LogOut size={15} />
                {loggingOut ? copy.loggingOut : copy.logout}
              </button>
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}
