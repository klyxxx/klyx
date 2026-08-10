"use client";

import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Euro,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { ProviderSearchResponse } from "@/lib/provider-search";
import {
  buildSearchRecoverySuggestions,
  recoveryHref,
  type SearchRecoveryFilters,
  type SearchRecoverySuggestion,
} from "@/lib/search-recovery";

function suggestionIcon(
  id: SearchRecoverySuggestion["id"]
) {
  if (
    id === "remove_budget" ||
    id === "raise_budget"
  ) {
    return Euro;
  }

  if (
    id === "remove_time" ||
    id === "remove_date" ||
    id === "shorter_duration"
  ) {
    return CalendarClock;
  }

  if (id === "remove_city") {
    return MapPin;
  }

  if (id === "remove_pricing") {
    return SlidersHorizontal;
  }

  return RefreshCw;
}

export default function SearchRecovery({
  filters,
  result,
}: {
  filters: SearchRecoveryFilters;
  result: ProviderSearchResponse;
}) {
  const suggestions =
    buildSearchRecoverySuggestions(filters, result);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-violet-500/25 bg-violet-500/[0.07]">
      <div className="border-b border-violet-500/15 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
            <BrainCircuit size={21} />
          </span>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              KLYX peut adapter la recherche
            </p>
            <h3 className="mt-2 text-xl font-bold text-foreground dark:text-white">
              Essaie une de ces corrections
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-zinc-400">
              Rien n’est modifié automatiquement. Tu choisis
              toi-même l’adaptation à appliquer.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:p-6">
        {suggestions.map((suggestion) => {
          const Icon = suggestionIcon(suggestion.id);

          return (
            <Link
              key={suggestion.id}
              href={recoveryHref(
                suggestion.nextFilters
              )}
              scroll={false}
              className="group flex items-start justify-between gap-4 rounded-2xl border border-border dark:border-zinc-800 bg-background dark:bg-zinc-950/55 p-4 transition hover:border-violet-500/50 hover:bg-violet-500/[0.08]"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-violet-300">
                  <Icon size={18} />
                </span>

                <div>
                  <p className="font-semibold text-foreground dark:text-white">
                    {suggestion.title}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground dark:text-zinc-400">
                    {suggestion.description}
                  </p>
                </div>
              </div>

              <ArrowRight
                className="mt-2 shrink-0 text-muted-foreground dark:text-zinc-500 transition group-hover:translate-x-1 group-hover:text-violet-300"
                size={18}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
