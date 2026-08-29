"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Navigation,
  Send,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getKlyxAssistantCommandExamples,
  translateKlyxAssistantCommand,
  type KlyxAssistantCommandMessageKey,
} from "@/lib/klyx-assistant-command-i18n";
import { supabase } from "@/lib/supabase";

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
  mode?: "existing_action" | "new_request" | "no_action";
  href?: string;
  action?: AssistantAction;
};

function ActionIcon({ kind }: { kind: string }) {
  if (kind === "payment_pending") return <CreditCard size={14} />;

  if (kind === "track_mission" || kind === "provider_track_mission") {
    return <Navigation size={14} />;
  }

  if (kind === "confirm_completion" || kind === "provider_finish_mission") {
    return <CheckCircle2 size={14} />;
  }

  return <Sparkles size={14} />;
}

export default function AssistantCommandBar({ actions = [] }: Props) {
  const router = useRouter();
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantCommandMessageKey) =>
    translateKlyxAssistantCommand(locale, key);
  const examples = getKlyxAssistantCommandExamples(locale);

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const suggestedActions = useMemo(() => actions.slice(0, 3), [actions]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const message = value.trim();
    if (!message || busy) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/brain/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        // Command routing never executes transactional actions from the browser.
        body: JSON.stringify({ message }),
      });

      const result = (await response.json()) as CommandResponse;

      if (!response.ok) throw new Error("Command unavailable");

      if (result.mode === "existing_action" && result.action?.href) {
        router.push(result.action.href);
        return;
      }

      if (result.href) {
        router.push(result.href);
        return;
      }

      router.push("/assistant/actions");
    } catch {
      setErrorMessage(t("genericError"));
      setBusy(false);
    }
  }

  return (
    <section className="w-full">
      <form
        onSubmit={submit}
        className="rounded-[26px] border border-border bg-card/90 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.10)] transition focus-within:border-violet-500/35 focus-within:ring-2 focus-within:ring-violet-500/8 dark:border-white/10 dark:bg-[#15131b]/95"
      >
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (value.trim() && !busy) event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          maxLength={700}
          placeholder="Demander à KLYX…"
          className="min-h-[86px] w-full resize-none bg-transparent px-3 py-3 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground"
        />

        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <button
            type="button"
            onClick={() => router.push("/request/photo")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-3.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground dark:border-white/10"
          >
            <Camera size={16} />
            {t("photo")}
          </button>

          <button
            type="submit"
            disabled={!value.trim() || busy}
            className="grid h-10 w-10 place-items-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={t("continue")}
          >
            {busy ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </form>

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 text-center text-xs font-semibold text-rose-600 dark:text-rose-300"
        >
          {errorMessage}
        </p>
      )}

      {suggestedActions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestedActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => router.push(action.href)}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/15 bg-violet-500/[0.05] px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-500/[0.09] dark:text-violet-300"
            >
              <ActionIcon kind={action.kind} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {examples.slice(0, 4).map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setValue(example)}
            className="rounded-full border border-border bg-background/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/[0.025]"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
