"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Brain, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type BrainPayload = {
  serviceSlug: string | null;
  city: string | null;
  date: string | null;
  time: string | null;
  budget: number | null;
  memoryUsed: boolean;
  ready: boolean;
};

export default function BrainPage() {
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour, je suis KLYX Brain. Décris ce que tu veux organiser.",
    },
  ]);
  const [input, setInput] = useState("");
  const [payload, setPayload] = useState<BrainPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message) return;

    setMessages((current) => [
      ...current,
      { role: "user", content: message },
    ]);

    setInput("");
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/brain/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const result = (await response.json()) as {
        conversationId?: string;
        reply?: string;
        payload?: BrainPayload;
        error?: string;
      };

      if (!response.ok || !result.reply) {
        throw new Error(result.error || "Réponse impossible.");
      }

      setConversationId(result.conversationId ?? null);
      setPayload(result.payload ?? null);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.reply as string,
        },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  function openResults() {
    if (!payload?.ready) return;

    if (payload.serviceSlug === "babysitting") {
      const params = new URLSearchParams();

      if (payload.city) params.set("city", payload.city);
      if (payload.date) params.set("date", payload.date);
      if (payload.time) params.set("time", payload.time);
      if (payload.budget != null) {
        params.set("budget", String(payload.budget));
      }

      router.push(`/babysitters?${params.toString()}`);
      return;
    }

    router.push(
      `/search?service=${encodeURIComponent(
        payload.serviceSlug || "all"
      )}`
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-400">
            Retour au tableau de bord
          </Link>

          <Link
            href="/memory"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-900"
          >
            <Brain size={17} />
            Mémoire
          </Link>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70">
          <header className="border-b border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
                <Sparkles size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-bold">KLYX Brain</h1>
                <p className="text-sm text-zinc-400">
                  Ton assistant personnel pour les services du quotidien
                </p>
              </div>
            </div>
          </header>

          <div className="min-h-[420px] space-y-4 p-6">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-violet-600"
                      : "border border-zinc-800 bg-zinc-950"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-sm text-zinc-400">
                KLYX réfléchit...
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {errorMessage}
              </div>
            )}
          </div>

          {payload?.ready && (
            <div className="border-t border-zinc-800 p-5">
              <button
                type="button"
                onClick={openResults}
                className="w-full rounded-xl bg-white px-6 py-4 font-semibold text-black hover:bg-zinc-200"
              >
                Voir les meilleurs prestataires
              </button>
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="flex gap-3 border-t border-zinc-800 p-5"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Exemple : J’ai besoin d’une baby-sitter demain."
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}