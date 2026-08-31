"use client";

import { Bot, Camera, CheckCircle2, CircleAlert, LoaderCircle, Play } from "lucide-react";
import { useState } from "react";

type ProbeCopy = {
  title: string;
  description: string;
  run: string;
  running: string;
  ready: string;
  notReady: string;
  assistant: string;
  vision: string;
  fallback: string;
  disabled: string;
  unavailable: string;
  adminOnly: string;
};

type ProbeResponse = {
  ready?: boolean;
  assistant?: {
    passed?: boolean;
    mode?: "openai" | "fallback";
  };
  vision?: {
    passed?: boolean;
    enabled?: boolean;
    used?: boolean;
    provider?: "openai" | "none";
    model?: string | null;
    fallbackReason?: string | null;
    confidence?: number | null;
  };
};

type OpenAiE2eProbeProps = {
  copy: ProbeCopy;
};

export default function OpenAiE2eProbe({ copy }: OpenAiE2eProbeProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ProbeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runProbe() {
    if (running) return;

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/openai-e2e", {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        setError(copy.adminOnly);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as ProbeResponse;

      if (!response.ok || typeof body.ready !== "boolean") {
        setError(copy.unavailable);
        return;
      }

      setResult(body);
    } catch {
      setError(copy.unavailable);
    } finally {
      setRunning(false);
    }
  }

  const assistantPassed = result?.assistant?.passed === true;
  const visionPassed = result?.vision?.passed === true;

  return (
    <section className="mt-8 klyx-card p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Play size={18} />
            <h2 className="text-xl font-black text-foreground">{copy.title}</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void runProbe()}
          disabled={running}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {running ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Play size={17} />
          )}
          {running ? copy.running : copy.run}
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-6">
          <div
            className={`flex items-center gap-3 rounded-2xl border p-4 ${
              result.ready
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {result.ready ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}
            <span className="font-black">
              {result.ready ? copy.ready : copy.notReady}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ProbeLine
              icon={<Bot size={18} />}
              label={copy.assistant}
              passed={assistantPassed}
              detail={
                assistantPassed
                  ? "OpenAI"
                  : result.assistant?.mode === "fallback"
                    ? copy.fallback
                    : copy.unavailable
              }
            />
            <ProbeLine
              icon={<Camera size={18} />}
              label={copy.vision}
              passed={visionPassed}
              detail={
                visionPassed
                  ? result.vision?.model || "OpenAI"
                  : result.vision?.enabled === false
                    ? copy.disabled
                    : result.vision?.fallbackReason || copy.unavailable
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ProbeLine({
  icon,
  label,
  passed,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-black">
          <span className="text-blue-600 dark:text-blue-400">{icon}</span>
          {label}
        </span>
        {passed ? (
          <CheckCircle2 size={18} className="text-emerald-500" />
        ) : (
          <CircleAlert size={18} className="text-amber-500" />
        )}
      </div>
      <p className="mt-2 break-words text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
