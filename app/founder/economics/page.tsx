"use client";

import { Calculator, Euro, Landmark, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxFounderEconomicsMoney,
  translateKlyxFounderEconomics,
  type KlyxFounderEconomicsMessageKey,
} from "@/lib/klyx-founder-economics-i18n";

// KLYX_FOUNDER_ECONOMICS_I18N

const DEFAULT_PERCENT = 15;

export default function FounderEconomicsPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFounderEconomicsMessageKey) => translateKlyxFounderEconomics(locale, key);
  const money = (value: number) => formatKlyxFounderEconomicsMoney(locale, value);
  const [amount, setAmount] = useState("100");
  const [percent, setPercent] = useState(String(DEFAULT_PERCENT));

  const result = useMemo(() => {
    const gross = Number(amount);
    const commissionPercent = Number(percent);

    if (
      !Number.isFinite(gross) ||
      gross < 0 ||
      !Number.isFinite(commissionPercent) ||
      commissionPercent < 0 ||
      commissionPercent > 100
    ) {
      return null;
    }

    const platform = Math.round(gross * commissionPercent) / 100;

    return {
      gross,
      platform,
      provider: Math.round((gross - platform) * 100) / 100,
    };
  }, [amount, percent]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">{t("eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
        </section>

        <section className="klyx-card mt-7 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Euro size={17} /> {t("clientPrice")}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="klyx-input"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Calculator size={17} /> {t("commission")}
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                className="klyx-input"
              />
            </label>
          </div>
        </section>

        {result && (
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="klyx-card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-600"><Euro size={20} /></div>
              <p className="mt-5 text-sm font-black text-muted-foreground">{t("clientPays")}</p>
              <p className="mt-2 text-3xl font-black">{money(result.gross)}</p>
            </article>

            <article className="klyx-card border-violet-500/20 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-600"><Landmark size={20} /></div>
              <p className="mt-5 text-sm font-black text-muted-foreground">{t("klyxReceives")}</p>
              <p className="mt-2 text-3xl font-black text-violet-600">{money(result.platform)}</p>
            </article>

            <article className="klyx-card border-emerald-500/20 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><WalletCards size={20} /></div>
              <p className="mt-5 text-sm font-black text-muted-foreground">{t("providerReceives")}</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{money(result.provider)}</p>
            </article>
          </section>
        )}

        <section className="klyx-card mt-6 p-6 sm:p-8">
          <h2 className="text-xl font-black">{t("examples")}</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-3">{t("mission")}</th>
                  <th className="pb-3">{t("klyx")}</th>
                  <th className="pb-3">{t("provider")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[50, 100, 250, 500, 1000].map((gross) => {
                  const fee = Math.round(gross * DEFAULT_PERCENT) / 100;
                  return (
                    <tr key={gross}>
                      <td className="py-3 font-black">{money(gross)}</td>
                      <td className="py-3 font-black text-violet-600">{money(fee)}</td>
                      <td className="py-3">{money(gross - fee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">{t("disclaimer")}</p>
        </section>
      </div>
    </main>
  );
}
