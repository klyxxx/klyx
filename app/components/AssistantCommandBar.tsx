"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Navigation,
  Sparkles,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getKlyxAssistantCommandExamples,
  translateKlyxAssistantCommand,
  type KlyxAssistantCommandMessageKey,
} from "@/lib/klyx-assistant-command-i18n";
import {
  supabase,
} from "@/lib/supabase";

// KLYX_TRUSTED_COMMAND_UI_12_81

type AssistantAction = {
  id: string;
  kind: string;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type Props = {
  actions?: AssistantAction[];
};

type CommandResponse = {
  mode?:
    | "existing_action"
    | "new_request"
    | "no_action";
  href?: string;
  action?: AssistantAction;
};

function ActionIcon({
  kind,
}: {
  kind: string;
}) {
  if (
    kind === "payment_pending"
  ) {
    return (
      <CreditCard size={15} />
    );
  }

  if (
    kind === "track_mission" ||
    kind ===
      "provider_track_mission"
  ) {
    return (
      <Navigation size={15} />
    );
  }

  if (
    kind ===
      "confirm_completion" ||
    kind ===
      "provider_finish_mission"
  ) {
    return (
      <CheckCircle2 size={15} />
    );
  }

  return (
    <Sparkles size={15} />
  );
}

export default function AssistantCommandBar({
  actions = [],
}: Props) {
  const router =
    useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantCommandMessageKey) =>
    translateKlyxAssistantCommand(locale, key);
  const examples = getKlyxAssistantCommandExamples(locale);

  const [
    value,
    setValue,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const suggestedActions =
    useMemo(
      () =>
        actions.slice(0, 3),
      [actions]
    );

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    const message =
      value.trim();

    if (
      !message ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        !session?.access_token
      ) {
        router.push(
          "/login"
        );
        return;
      }

      const response =
        await fetch(
          "/api/brain/command",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                "Bearer " +
                session.access_token,
            },

            // KLYX 12.81:
            // NO actions from browser.
            body:
              JSON.stringify({
                message,
              }),
          }
        );

      const result =
        (await response.json()) as
          CommandResponse;

      if (!response.ok) {
        throw new Error("Command unavailable");
      }

      if (
        result.mode ===
          "existing_action" &&
        result.action?.href
      ) {
        router.push(
          result.action.href
        );
        return;
      }

      if (result.href) {
        router.push(
          result.href
        );
        return;
      }

      router.push(
        "/assistant/actions"
      );
    } catch {
      setErrorMessage(
        t("genericError")
      );

      setBusy(false);
    }
  }

  return (
    <section className="mt-7">
      <form
        onSubmit={submit}
        className="rounded-[28px] border border-border bg-card p-2 shadow-sm"
      >
        <div className="flex items-center gap-3 px-3 pt-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
          <Sparkles
            size={15}
            className="text-violet-600 dark:text-violet-400"
          />
          {t("eyebrow")}
        </div>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <textarea
            value={value}
            onChange={(
              event
            ) =>
              setValue(
                event.target.value
              )
            }
            rows={2}
            maxLength={700}
            placeholder={t("placeholder")}
            className="min-h-[74px] flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/request/photo"
                )
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted"
            >
              <Camera
                size={18}
              />

              <span className="hidden md:inline">
                {t("photo")}
              </span>
            </button>

            <button
              type="submit"
              disabled={
                !value.trim() ||
                busy
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <ArrowRight
                  size={18}
                />
              )}

              {t("continue")}
            </button>
          </div>
        </div>
      </form>

      {errorMessage && (
        <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {suggestedActions.length >
        0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            {t("actionsDetected")}
          </p>

          <div className="flex flex-wrap gap-2">
            {suggestedActions.map(
              (action) => (
                <button
                  key={
                    action.id
                  }
                  type="button"
                  onClick={() =>
                    router.push(
                      action.href
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
                >
                  <ActionIcon
                    kind={
                      action.kind
                    }
                  />

                  {action.label}
                </button>
              )
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map(
          (example) => (
            <button
              key={example}
              type="button"
              onClick={() =>
                setValue(
                  example
                )
              }
              className="rounded-full border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {example}
            </button>
          )
        )}
      </div>
    </section>
  );
}
