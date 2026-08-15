"use client";

import {
  Check,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  KLYX_SUPPORTED_MARKETS,
  getKlyxMarket,
} from "@/lib/klyx-supported-markets";

type Props = {
  value: string;
  onChange: (countryCode: string) => void;
  required?: boolean;
  disabled?: boolean;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

// KLYX_PROFILE_MARKET_SELECTOR_14_21
export default function KlyxMarketSelect({
  value,
  onChange,
  required = false,
  disabled = false,
}: Props) {
  const id = useId();

  const rootRef =
    useRef<HTMLDivElement | null>(null);

  const searchRef =
    useRef<HTMLInputElement | null>(null);

  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const selected =
    getKlyxMarket(value);

  const markets =
    useMemo(() => {
      const normalizedQuery =
        normalize(query);

      const ordered =
        [...KLYX_SUPPORTED_MARKETS].sort(
          (a, b) =>
            a.countryName.localeCompare(
              b.countryName,
              "fr"
            )
        );

      if (!normalizedQuery) {
        return ordered;
      }

      return ordered.filter(
        (market) => {
          const searchable =
            normalize(
              [
                market.countryName,
                market.countryCode,
                market.currencyCode,
                market.currencyName,
              ].join(" ")
            );

          return searchable.includes(
            normalizedQuery
          );
        }
      );
    }, [query]);

  useEffect(() => {
    function outsideClick(
      event: MouseEvent
    ) {
      if (
        rootRef.current &&
        !rootRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      outsideClick
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        outsideClick
      );
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const timer =
      window.setTimeout(
        () =>
          searchRef.current?.focus(),
        0
      );

    return () =>
      window.clearTimeout(timer);
  }, [open]);

  function choose(
    countryCode: string
  ) {
    onChange(countryCode);
    setOpen(false);
    setQuery("");
  }

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}

      <button
        id={id}
        type="button"
        role="combobox"
        aria-label="Pays"
        aria-expanded={open}
        disabled={disabled}
        onClick={() =>
          !disabled &&
          setOpen(
            (current) => !current
          )
        }
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm outline-none transition ${
          open
            ? "border-violet-500 bg-background ring-2 ring-violet-500/20"
            : "border-input bg-background hover:border-violet-500/40"
        }`}
      >
        <span className="min-w-0 truncate">
          {selected
            ? `${selected.countryName} · ${selected.currencyCode}`
            : "Choisir un pays"}
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-[170] mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* KLYX_PROFILE_MARKET_SEARCH_14_21 */}
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search
                size={17}
                className="text-muted-foreground"
              />

              <input
                ref={searchRef}
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Belgique, Canada, USD, EUR..."
                className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />

              {query && (
                <button
                  type="button"
                  onClick={() =>
                    setQuery("")
                  }
                  aria-label="Effacer"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {markets.length} marché
              {markets.length > 1
                ? "s"
                : ""}
            </p>
          </div>

          <div className="klyx-scrollbar max-h-72 overflow-y-auto p-2">
            {markets.map(
              (market) => {
                const isSelected =
                  market.countryCode ===
                  value;

                return (
                  <button
                    key={
                      market.countryCode
                    }
                    type="button"
                    onClick={() =>
                      choose(
                        market.countryCode
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition ${
                      isSelected
                        ? "bg-violet-600 text-white"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {
                          market.countryName
                        }
                      </span>

                      <span
                        className={`block text-xs ${
                          isSelected
                            ? "text-white/75"
                            : "text-muted-foreground"
                        }`}
                      >
                        {
                          market.currencyCode
                        }{" "}
                        ·{" "}
                        {
                          market.currencySymbol
                        }
                      </span>
                    </span>

                    {isSelected && (
                      <Check
                        size={17}
                        className="shrink-0"
                      />
                    )}
                  </button>
                );
              }
            )}

            {markets.length === 0 && (
              <div className="p-5 text-center text-sm text-muted-foreground">
                Aucun pays trouvé.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// KLYX_COUNTRY_CURRENCY_AUTOMATIC_UI_14_21