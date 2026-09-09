"use client";

export type AssistantSuggestion = {
  id: string;
  label: string;
  value: string;
};

export default function SuggestionGroup({
  suggestions,
  onSelect,
  disabled = false,
  ariaLabel,
}: {
  suggestions: readonly AssistantSuggestion[];
  onSelect: (suggestion: AssistantSuggestion) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" aria-label={ariaLabel}>
      {suggestions.slice(0, 3).map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className="min-h-10 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
