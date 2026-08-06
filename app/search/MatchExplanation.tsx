"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { ProviderSearchItem } from "@/lib/provider-search";
import {
  explainProviderMatch,
  matchingLevelLabel,
  type MatchingFilters,
} from "@/lib/intelligent-matching";

export default function MatchExplanation({
  provider,
  filters,
}: {
  provider: ProviderSearchItem;
  filters: MatchingFilters;
}) {
  const [expanded, setExpanded] = useState(false);
  const explanation = explainProviderMatch(
    provider,
    filters
  );

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/[0.06]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white">
            <Sparkles size={18} />
          </span>

          <div>
            <p className="text-sm font-black text-white">
              {explanation.score}/100 ·{" "}
              {matchingLevelLabel(explanation.level)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Voir pourquoi KLYX propose ce profil
            </p>
          </div>
        </div>

        {expanded ? (
          <ChevronUp
            className="shrink-0 text-zinc-400"
            size={18}
          />
        ) : (
          <ChevronDown
            className="shrink-0 text-zinc-400"
            size={18}
          />
        )}
      </button>

      {expanded && (
        <div className="border-t border-violet-500/15 p-4">
          {explanation.reasons.length > 0 && (
            <div className="space-y-2">
              {explanation.reasons.map((reason) => (
                <p
                  key={reason}
                  className="flex items-start gap-2 text-xs leading-5 text-zinc-300"
                >
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-emerald-400"
                    size={14}
                  />
                  {reason}
                </p>
              ))}
            </div>
          )}

          {explanation.warnings.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
              {explanation.warnings.map((warning) => (
                <p
                  key={warning}
                  className="flex items-start gap-2 text-xs leading-5 text-amber-200"
                >
                  <AlertTriangle
                    className="mt-0.5 shrink-0"
                    size={14}
                  />
                  {warning}
                </p>
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] leading-5 text-zinc-500">
            Ce score explique une compatibilité avec cette
            recherche. Il ne garantit pas la qualité future et
            ne remplace pas ton choix.
          </p>
        </div>
      )}
    </section>
  );
}
