"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Camera, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "J’ai besoin d’un plombier demain à Bruxelles",
  "Trouve quelqu’un pour monter un meuble",
  "Je cherche une aide ménagère cette semaine",
];

export default function AssistantCommandBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();

    const request = value.trim();
    if (!request || busy) return;

    setBusy(true);

    const params = new URLSearchParams();
    params.set("request", request);

    router.push(`/assistant/market?${params.toString()}`);
  }

  return (
    <section className="mt-7">
      <form
        onSubmit={submit}
        className="rounded-[28px] border border-border bg-card p-2 shadow-sm"
      >
        <div className="flex items-center gap-3 px-3 pt-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
          <Sparkles size={15} className="text-violet-600 dark:text-violet-400" />
          Demande à KLYX
        </div>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={2}
            maxLength={700}
            placeholder="Décris simplement ce dont tu as besoin..."
            className="min-h-[74px] flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/request/photo")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted"
              aria-label="Décrire un besoin avec une photo"
            >
              <Camera size={18} />
              <span className="hidden md:inline">Photo</span>
            </button>

            <button
              type="submit"
              disabled={!value.trim() || busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              Continuer
            </button>
          </div>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setValue(example)}
            className="rounded-full border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
