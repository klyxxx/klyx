import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Bot, CheckCircle2, ShieldCheck } from "lucide-react";

import { isKlyxAiEnabled } from "@/lib/klyx-ai";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { getKlyxAiStatusPageDictionary } from "@/lib/klyx-ai-status-page-i18n";

export const dynamic = "force-dynamic";

async function getAiStatusLocale() {
  const cookieStore = await cookies();

  return normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );
}

// KLYX_AI_STATUS_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAiStatusLocale();
  const copy = getKlyxAiStatusPageDictionary(locale);

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
  };
}

export default async function AiStatusPage() {
  const locale = await getAiStatusLocale();
  const copy = getKlyxAiStatusPageDictionary(locale);
  const enabled = isKlyxAiEnabled();

  return (
    <main className="klyx-page">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
      >
        <ArrowLeft size={17} />
        {copy.backDashboard}
      </Link>

      <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#30135c_52%,#111827)] p-8 text-white">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]">
          <Bot size={15} />
          {copy.badge}
        </div>

        <h1 className="mt-5 text-3xl font-black sm:text-5xl">
          {copy.title}
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
          {copy.description}
        </p>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="klyx-card p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2
              className={
                enabled ? "text-emerald-500" : "text-amber-500"
              }
            />
            <h2 className="text-xl font-black">
              {enabled ? copy.enabledTitle : copy.fallbackTitle}
            </h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {enabled ? copy.enabledDescription : copy.fallbackDescription}
          </p>
        </article>

        <article className="klyx-card p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-violet-600" />
            <h2 className="text-xl font-black">{copy.safetyTitle}</h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {copy.safetyDescription}
          </p>
        </article>
      </section>
    </main>
  );
}
