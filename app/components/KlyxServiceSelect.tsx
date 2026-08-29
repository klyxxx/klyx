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

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";

export type KlyxServiceSearchOption = {
  value: string;
  label: string;
  keywords?: string;
};

type KlyxServiceSelectProps = {
  value: string;
  options: KlyxServiceSearchOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

type ServiceSelectCopy = {
  placeholder: string;
  searchPlaceholder: string;
  ariaLabel: string;
  clearSearch: string;
  resultLabel: (count: number) => string;
  servicesLabel: (count: number) => string;
  typeToSearch: string;
  noService: string;
  noServiceHint: string;
  clearSelected: string;
};

const COPY: Record<"fr" | "en" | "nl" | "de", ServiceSelectCopy> = {
  fr: {
    placeholder: "Choisir un métier",
    searchPlaceholder: "Rechercher un métier...",
    ariaLabel: "Métier",
    clearSearch: "Effacer la recherche",
    resultLabel: (count) => `${count} résultat${count > 1 ? "s" : ""}`,
    servicesLabel: (count) => `${count} métiers disponibles`,
    typeToSearch: "Tape pour rechercher",
    noService: "Aucun métier trouvé",
    noServiceHint: "Essaie un autre mot ou recherche « Autre métier ».",
    clearSelected: "Effacer le métier sélectionné",
  },
  en: {
    placeholder: "Choose a service",
    searchPlaceholder: "Search for a service...",
    ariaLabel: "Service",
    clearSearch: "Clear search",
    resultLabel: (count) => `${count} result${count === 1 ? "" : "s"}`,
    servicesLabel: (count) => `${count} services available`,
    typeToSearch: "Type to search",
    noService: "No service found",
    noServiceHint: "Try another term or search for “Other service”.",
    clearSelected: "Clear selected service",
  },
  nl: {
    placeholder: "Kies een dienst",
    searchPlaceholder: "Zoek een dienst...",
    ariaLabel: "Dienst",
    clearSearch: "Zoekopdracht wissen",
    resultLabel: (count) => `${count} resulta${count === 1 ? "at" : "ten"}`,
    servicesLabel: (count) => `${count} diensten beschikbaar`,
    typeToSearch: "Typ om te zoeken",
    noService: "Geen dienst gevonden",
    noServiceHint: "Probeer een andere term of zoek naar ‘Andere dienst’.",
    clearSelected: "Geselecteerde dienst wissen",
  },
  de: {
    placeholder: "Dienstleistung auswählen",
    searchPlaceholder: "Dienstleistung suchen...",
    ariaLabel: "Dienstleistung",
    clearSearch: "Suche löschen",
    resultLabel: (count) => `${count} Ergebnis${count === 1 ? "" : "se"}`,
    servicesLabel: (count) => `${count} Dienstleistungen verfügbar`,
    typeToSearch: "Zum Suchen tippen",
    noService: "Keine Dienstleistung gefunden",
    noServiceHint: "Versuche einen anderen Begriff oder suche nach „Andere Dienstleistung“.",
    clearSelected: "Ausgewählte Dienstleistung löschen",
  },
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

// KLYX_UNIVERSAL_SERVICE_SEARCH_14_18
export default function KlyxServiceSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  required = false,
  disabled = false,
  ariaLabel,
}: KlyxServiceSelectProps) {
  const { locale } = useKlyxLocale();
  const copy =
    locale === "fr" || locale === "nl" || locale === "de"
      ? COPY[locale]
      : COPY.en;

  const resolvedPlaceholder = placeholder ?? copy.placeholder;
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? copy.searchPlaceholder;
  const resolvedAriaLabel = ariaLabel ?? copy.ariaLabel;

  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return options.slice(0, 60);
    }

    return options
      .filter((option) => {
        const haystack = normalizeSearch(
          `${option.label} ${option.keywords ?? ""}`
        );

        return haystack.includes(normalizedQuery);
      })
      .slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () =>
      document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const timer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  function choose(option: KlyxServiceSearchOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    onChange("");
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
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
        aria-label={resolvedAriaLabel}
        aria-expanded={open}
        aria-controls={`${id}-services`}
        disabled={disabled}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-semibold shadow-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
            : open
              ? "border-violet-500 bg-background ring-4 ring-violet-500/10"
              : "border-border bg-background hover:border-violet-500/40"
        }`}
      >
        <span
          className={
            selectedOption
              ? "min-w-0 truncate text-foreground"
              : "min-w-0 truncate text-muted-foreground"
          }
        >
          {selectedOption?.label ?? resolvedPlaceholder}
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div
          id={`${id}-services`}
          className="absolute left-0 right-0 z-[160] mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* KLYX_SERVICE_SEARCH_INPUT_14_18 */}
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search
                size={17}
                className="shrink-0 text-muted-foreground"
              />

              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                  }

                  if (
                    event.key === "Enter" &&
                    filteredOptions.length === 1
                  ) {
                    event.preventDefault();
                    choose(filteredOptions[0]);
                  }
                }}
                placeholder={resolvedSearchPlaceholder}
                className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={copy.clearSearch}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {query
                  ? copy.resultLabel(filteredOptions.length)
                  : copy.servicesLabel(options.length)}
              </span>

              {!query && options.length > 60 && (
                <span>{copy.typeToSearch}</span>
              )}
            </div>
          </div>

          <div className="klyx-scrollbar max-h-72 overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choose(option)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition ${
                      selected
                        ? "bg-violet-600 font-black text-white"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {option.label}
                    </span>

                    {selected && (
                      <Check size={17} className="shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-5 text-center">
                <p className="text-sm font-bold">{copy.noService}</p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copy.noServiceHint}
                </p>
              </div>
            )}
          </div>

          {selectedOption && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={clearSelection}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {copy.clearSelected}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// KLYX_ALL_DB_SERVICES_SEARCHABLE_14_18
