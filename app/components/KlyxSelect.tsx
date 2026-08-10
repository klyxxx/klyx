"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export type KlyxSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type KlyxSelectProps = {
  value: string;
  options: KlyxSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
  ariaLabel?: string;
};

export default function KlyxSelect({
  value,
  options,
  onChange,
  placeholder = "Choisir",
  disabled = false,
  required = false,
  name,
  className = "",
  ariaLabel,
}: KlyxSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options]
  );

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const selectedIndex = enabledOptions.findIndex(
      (option) => option.value === value
    );

    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, enabledOptions, value]);

  function choose(option: KlyxSelectOption) {
    if (option.disabled) return;

    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>
  ) {
    if (disabled) return;

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, enabledOptions.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = enabledOptions[activeIndex];
      if (option) choose(option);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
        />
      )}

      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          className="pointer-events-none absolute left-1/2 top-full h-px w-px -translate-x-1/2 opacity-0"
        />
      )}

      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-semibold shadow-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/5 bg-white/[0.025] text-muted-foreground dark:text-white/30"
            : open
              ? "border-violet-500/70 bg-background dark:bg-zinc-950 text-foreground dark:text-white ring-4 ring-violet-500/10"
              : "border-border dark:border-white/10 bg-background/80 dark:bg-zinc-950/80 text-foreground dark:text-white hover:border-violet-500/40 hover:bg-card dark:bg-zinc-900"
        }`}
      >
        <span
          className={
            selectedOption
              ? "truncate text-foreground dark:text-white"
              : "truncate text-muted-foreground dark:text-zinc-500"
          }
        >
          {selectedOption?.label ?? placeholder}
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground dark:text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-violet-300" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="klyx-scrollbar absolute left-0 right-0 z-[140] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border dark:border-white/10 bg-background/95 dark:bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-2xl"
        >
          {options.map((option) => {
            const selected = option.value === value;
            const enabledIndex = enabledOptions.findIndex(
              (item) => item.value === option.value
            );
            const active = enabledIndex === activeIndex;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => {
                  if (!option.disabled && enabledIndex >= 0) {
                    setActiveIndex(enabledIndex);
                  }
                }}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition ${
                  option.disabled
                    ? "cursor-not-allowed text-zinc-700"
                    : selected
                      ? "bg-gradient-to-r from-violet-600/25 to-indigo-600/20 font-black text-white"
                      : active
                        ? "bg-white/[0.07] text-white"
                        : "text-foreground/80 dark:text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="truncate">{option.label}</span>

                {selected && (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-600 text-white">
                    <Check size={15} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

