"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Unlink2,
  X,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxProviderCapabilitiesPage,
  translateKlyxProviderCapabilityStatus,
  type KlyxProviderCapabilitiesPageMessageKey,
} from "@/lib/klyx-provider-capabilities-page-i18n";
import {
  KLYX_PROVIDER_CAPABILITY_LABEL_MAX_LENGTH,
  KLYX_PROVIDER_CAPABILITY_LABEL_MIN_LENGTH,
} from "@/lib/provider-capabilities";
import { supabase } from "@/lib/supabase";

type Capability = {
  id: string;
  label: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CapabilityLink = {
  id: string;
  capability_id: string;
  user_service_id: string;
  created_at: string;
};

type StudioService = {
  name?: string;
  title?: string;
  userServiceId?: string | null;
  enabled?: boolean;
};

type StudioData = {
  services?: StudioService[];
};

type ApiErrorBody = {
  code?: string;
};

const DESCRIPTION_MAX_LENGTH = 1200;

export default function ProviderCapabilitiesPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderCapabilitiesPageMessageKey) =>
    translateKlyxProviderCapabilitiesPage(locale, key);

  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [links, setLinks] = useState<CapabilityLink[]>([]);
  const [services, setServices] = useState<StudioService[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("KLYX_PROVIDER_CAPABILITIES_SESSION_REQUIRED");
        }

        const headers = {
          Authorization: `Bearer ${session.access_token}`,
        };

        const [capabilitiesResponse, linksResponse, studioResponse] =
          await Promise.all([
            fetch("/api/provider/capabilities", {
              cache: "no-store",
              headers,
            }),
            fetch("/api/provider/capability-links", {
              cache: "no-store",
              headers,
            }),
            fetch("/api/provider/studio", {
              cache: "no-store",
              headers,
            }),
          ]);

        const capabilitiesBody = (await capabilitiesResponse.json()) as {
          capabilities?: Capability[];
        };
        const linksBody = (await linksResponse.json()) as {
          links?: CapabilityLink[];
        };

        if (!capabilitiesResponse.ok || !linksResponse.ok) {
          throw new Error("KLYX_PROVIDER_CAPABILITIES_LOAD_FAILED");
        }

        let studio: StudioData = {};
        if (studioResponse.ok) {
          const studioBody = (await studioResponse.json()) as StudioData & {
            data?: StudioData;
          };
          studio = studioBody.data ?? studioBody;
        }

        if (!cancelled) {
          setCapabilities(capabilitiesBody.capabilities ?? []);
          setLinks(linksBody.links ?? []);
          setServices(
            (studio.services ?? []).filter(
              (service) =>
                service.enabled === true &&
                typeof service.userServiceId === "string" &&
                service.userServiceId.length > 0
            )
          );
        }
      } catch {
        if (!cancelled) {
          setErrorMessage(t("loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const confirmedCapabilities = useMemo(
    () => capabilities.filter((capability) => capability.status === "confirmed"),
    [capabilities]
  );

  const archivedCapabilities = useMemo(
    () => capabilities.filter((capability) => capability.status === "archived"),
    [capabilities]
  );

  async function sessionHeaders(includeJson = false) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("KLYX_PROVIDER_CAPABILITIES_SESSION_REQUIRED");
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
    };
  }

  function applyCapability(updated: Capability) {
    setCapabilities((current) =>
      current.map((capability) =>
        capability.id === updated.id ? updated : capability
      )
    );
  }

  function showActionError(body?: ApiErrorBody) {
    setMessage("");
    setErrorMessage(
      body?.code === "KLYX_PROVIDER_CAPABILITY_DUPLICATE"
        ? t("duplicateError")
        : t("saveError")
    );
  }

  async function addCapability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/capabilities", {
        method: "POST",
        headers: await sessionHeaders(true),
        body: JSON.stringify({ label, description }),
      });
      const body = (await response.json()) as {
        capability?: Capability;
        code?: string;
      };

      if (!response.ok || !body.capability) {
        showActionError(body);
        return;
      }

      setCapabilities((current) => [body.capability!, ...current]);
      setLabel("");
      setDescription("");
      setMessage(t("addedSuccess"));
    } catch {
      setErrorMessage(t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(capability: Capability) {
    setEditId(capability.id);
    setEditLabel(capability.label);
    setEditDescription(capability.description ?? "");
    setMessage("");
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditId("");
    setEditLabel("");
    setEditDescription("");
  }

  async function saveEdit(capabilityId: string) {
    const key = `edit:${capabilityId}`;
    setPendingKey(key);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/capabilities", {
        method: "PATCH",
        headers: await sessionHeaders(true),
        body: JSON.stringify({
          id: capabilityId,
          label: editLabel,
          description: editDescription,
        }),
      });
      const body = (await response.json()) as {
        capability?: Capability;
        code?: string;
      };

      if (!response.ok || !body.capability) {
        showActionError(body);
        return;
      }

      applyCapability(body.capability);
      cancelEdit();
      setMessage(t("updatedSuccess"));
    } catch {
      setErrorMessage(t("saveError"));
    } finally {
      setPendingKey("");
    }
  }

  async function changeStatus(capability: Capability) {
    const restoring = capability.status === "archived";
    const key = `status:${capability.id}`;
    setPendingKey(key);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/capabilities", {
        method: "PATCH",
        headers: await sessionHeaders(true),
        body: JSON.stringify({
          id: capability.id,
          status: restoring ? "confirmed" : "archived",
        }),
      });
      const body = (await response.json()) as {
        capability?: Capability;
        code?: string;
      };

      if (!response.ok || !body.capability) {
        showActionError(body);
        return;
      }

      applyCapability(body.capability);
      if (editId === capability.id) cancelEdit();
      setMessage(restoring ? t("restoredSuccess") : t("archivedSuccess"));
    } catch {
      setErrorMessage(t("saveError"));
    } finally {
      setPendingKey("");
    }
  }

  async function toggleLink(capabilityId: string, userServiceId: string) {
    const existing = links.find(
      (link) =>
        link.capability_id === capabilityId &&
        link.user_service_id === userServiceId
    );
    const key = `link:${capabilityId}:${userServiceId}`;
    setPendingKey(key);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/provider/capability-links", {
        method: existing ? "DELETE" : "POST",
        headers: await sessionHeaders(true),
        body: JSON.stringify({ capabilityId, userServiceId }),
      });
      const body = (await response.json()) as {
        link?: CapabilityLink;
      };

      if (!response.ok) {
        setErrorMessage(t("saveError"));
        return;
      }

      if (existing) {
        setLinks((current) => current.filter((link) => link.id !== existing.id));
      } else if (body.link) {
        setLinks((current) => [...current, body.link!]);
      }
    } catch {
      setErrorMessage(t("saveError"));
    } finally {
      setPendingKey("");
    }
  }

  function capabilityCard(capability: Capability) {
    const editing = editId === capability.id;
    const confirmed = capability.status === "confirmed";
    const statusPending = pendingKey === `status:${capability.id}`;

    return (
      <article key={capability.id} className="klyx-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black">{capability.label}</h3>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                  confirmed
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-zinc-500/20 bg-zinc-500/10 text-muted-foreground"
                }`}
              >
                {translateKlyxProviderCapabilityStatus(locale, capability.status)}
              </span>
            </div>

            {!editing && capability.description && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {capability.description}
              </p>
            )}
          </div>

          {!editing && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => beginEdit(capability)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-black transition hover:bg-muted"
              >
                <Pencil size={14} />
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={() => void changeStatus(capability)}
                disabled={statusPending}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-black transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
              >
                {statusPending ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : confirmed ? (
                  <Archive size={14} />
                ) : (
                  <RotateCcw size={14} />
                )}
                {confirmed ? t("archive") : t("restore")}
              </button>
            </div>
          )}
        </div>

        {editing && (
          <div className="mt-5 grid gap-4 rounded-2xl border border-border/80 bg-muted/30 p-4">
            <input
              value={editLabel}
              onChange={(event) => setEditLabel(event.target.value)}
              minLength={KLYX_PROVIDER_CAPABILITY_LABEL_MIN_LENGTH}
              maxLength={KLYX_PROVIDER_CAPABILITY_LABEL_MAX_LENGTH}
              className="klyx-input"
            />
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              maxLength={DESCRIPTION_MAX_LENGTH}
              className="klyx-input min-h-28 resize-y py-3"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveEdit(capability.id)}
                disabled={pendingKey === `edit:${capability.id}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-foreground px-3 text-xs font-black text-background disabled:cursor-wait disabled:opacity-60"
              >
                {pendingKey === `edit:${capability.id}` ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {pendingKey === `edit:${capability.id}` ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-black"
              >
                <X size={14} />
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {confirmed && (
          <div className="mt-6 border-t border-border/80 pt-5">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-violet-600 dark:text-violet-400" />
              <p className="text-sm font-black">{t("linkedOffers")}</p>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
              {t("offerHelp")}
            </p>

            {services.length === 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-sm">
                <span className="text-muted-foreground">{t("noActiveOffer")}</span>
                <Link href="/provider" className="font-black text-blue-600 dark:text-blue-400">
                  {t("manageOffers")}
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => {
                  const userServiceId = service.userServiceId as string;
                  const linked = links.some(
                    (link) =>
                      link.capability_id === capability.id &&
                      link.user_service_id === userServiceId
                  );
                  const key = `link:${capability.id}:${userServiceId}`;
                  const pending = pendingKey === key;

                  return (
                    <div
                      key={userServiceId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 p-3"
                    >
                      <span className="min-w-0 truncate text-sm font-bold">
                        {(service.title ?? "").trim() || service.name || "KLYX"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void toggleLink(capability.id, userServiceId)}
                        disabled={pending}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${
                          linked
                            ? "border border-border bg-muted"
                            : "bg-violet-600 text-white"
                        }`}
                      >
                        {pending ? (
                          <LoaderCircle size={13} className="animate-spin" />
                        ) : linked ? (
                          <Unlink2 size={13} />
                        ) : (
                          <Link2 size={13} />
                        )}
                        {pending ? t("linking") : linked ? t("unlink") : t("link")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/provider"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          {t("backToProvider")}
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#16112a_0%,#3b1b6d_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(61,31,110,0.25)] sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
              <Sparkles size={15} />
              {t("eyebrow")}
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
              {t("description")}
            </p>
            <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-white/10 bg-white/7 p-4 text-sm leading-6 text-white/75">
              <BadgeCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <span>{t("ordinarySkillNote")}</span>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Plus size={21} />
            </span>
            <div>
              <p className="klyx-eyebrow">{t("addEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                {t("addTitle")}
              </h2>
            </div>
          </div>

          <form onSubmit={addCapability} className="mt-7 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-black">{t("label")}</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                minLength={KLYX_PROVIDER_CAPABILITY_LABEL_MIN_LENGTH}
                maxLength={KLYX_PROVIDER_CAPABILITY_LABEL_MAX_LENGTH}
                className="klyx-input"
                placeholder={t("labelPlaceholder")}
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center justify-between gap-3 text-sm font-black">
                {t("descriptionLabel")}
                <span className="text-xs font-medium text-muted-foreground">
                  {t("optional")} · {description.length}/{DESCRIPTION_MAX_LENGTH}
                </span>
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                className="klyx-input min-h-32 resize-y py-4"
                placeholder={t("descriptionPlaceholder")}
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 w-fit items-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Plus size={17} />
              )}
              {submitting ? t("adding") : t("addButton")}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-black tracking-[-0.035em]">
            {t("myCapabilities")}
          </h2>

          {loading ? (
            <div className="mt-5 grid min-h-40 place-items-center rounded-[1.75rem] border border-border/80">
              <LoaderCircle size={30} className="animate-spin text-violet-600" />
            </div>
          ) : capabilities.length === 0 ? (
            <div className="klyx-card mt-5 p-7 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {confirmedCapabilities.map(capabilityCard)}
              {archivedCapabilities.map(capabilityCard)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
