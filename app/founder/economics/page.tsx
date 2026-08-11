"use client";

import {
  Calculator,
  Euro,
  Landmark,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

const DEFAULT_PERCENT = 15;

function money(value: number): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function FounderEconomicsPage() {
  const [amount, setAmount] = useState("100");
  const [percent, setPercent] = useState(
    String(DEFAULT_PERCENT)
  );

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

    const platform =
      Math.round(
        gross * commissionPercent
      ) / 100;

    return {
      gross,
      platform,
      provider:
        Math.round(
          (gross - platform) * 100
        ) / 100,
    };
  }, [amount, percent]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
            Économie KLYX
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-5xl">
            Combien gagne KLYX par mission ?
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Le checkout Stripe utilise actuellement une commission
            configurable avec KLYX_COMMISSION_PERCENT. La valeur
            par défaut est 15 %.
          </p>
        </section>

        <section className="klyx-card mt-7 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Euro size={17} />
                Prix payé par le client
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                className="klyx-input"
              />
            </label>

            <label>
              <span className="mb-2 flex items-center gap-2 text-sm font-black">
                <Calculator size={17} />
                Commission KLYX (%)
              </span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={percent}
                onChange={(event) =>
                  setPercent(event.target.value)
                }
                className="klyx-input"
              />
            </label>
          </div>
        </section>

        {result && (
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="klyx-card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
                <Euro size={20} />
              </div>

              <p className="mt-5 text-sm font-black text-muted-foreground">
                Client paie
              </p>

              <p className="mt-2 text-3xl font-black">
                {money(result.gross)}
              </p>
            </article>

            <article className="klyx-card border-violet-500/20 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                <Landmark size={20} />
              </div>

              <p className="mt-5 text-sm font-black text-muted-foreground">
                KLYX reçoit
              </p>

              <p className="mt-2 text-3xl font-black text-violet-600">
                {money(result.platform)}
              </p>
            </article>

            <article className="klyx-card border-emerald-500/20 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <WalletCards size={20} />
              </div>

              <p className="mt-5 text-sm font-black text-muted-foreground">
                Prestataire reçoit
              </p>

              <p className="mt-2 text-3xl font-black text-emerald-600">
                {money(result.provider)}
              </p>
            </article>
          </section>
        )}

        <section className="klyx-card mt-6 p-6 sm:p-8">
          <h2 className="text-xl font-black">
            Exemples avec 15 %
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="pb-3">Mission</th>
                  <th className="pb-3">KLYX</th>
                  <th className="pb-3">Prestataire</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {[50, 100, 250, 500, 1000].map(
                  (gross) => {
                    const fee =
                      Math.round(
                        gross *
                          DEFAULT_PERCENT
                      ) / 100;

                    return (
                      <tr key={gross}>
                        <td className="py-3 font-black">
                          {money(gross)}
                        </td>
                        <td className="py-3 font-black text-violet-600">
                          {money(fee)}
                        </td>
                        <td className="py-3">
                          {money(gross - fee)}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Ces montants représentent la commission applicative KLYX
            avant prise en compte d’éventuels coûts Stripe, taxes,
            remboursements ou autres charges de l’entreprise.
          </p>
        </section>
      </div>
    </main>
  );
}
