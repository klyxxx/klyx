import Link from "next/link";

type KlyxLogoProps = {
  compact?: boolean;
  href?: string;
  dark?: boolean;
};

export default function KlyxLogo({
  compact = false,
  href = "/",
  dark = false,
}: KlyxLogoProps) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-3"
      aria-label="KLYX — Accueil"
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[15px] bg-white shadow-[0_12px_34px_rgba(37,99,235,0.22)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_40px_rgba(37,99,235,0.3)]">
        <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
          <path
            d="M10 7v26h6V22.8L26.5 33H35L21.6 19.7 34 7h-8.1L16 17.4V7H10Z"
            fill="#09090b"
          />
          <path d="M25.8 7 20 13l4.1 4.1L34 7h-8.2Z" fill="#2563eb" />
        </svg>
      </span>

      {!compact && (
        <span
          className={`text-[1.7rem] font-black tracking-[-0.06em] ${
            dark ? "text-zinc-950 dark:text-white" : "text-foreground dark:text-white"
          }`}
        >
          KLYX
        </span>
      )}
    </Link>
  );
}
