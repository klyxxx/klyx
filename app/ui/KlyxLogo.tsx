import Link from "next/link";

export default function KlyxLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="KLYX — Accueil">
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_10px_35px_rgba(124,58,237,0.35)]">
        <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
          <path d="M10 7v26h6V22.8L26.5 33H35L21.6 19.7 34 7h-8.1L16 17.4V7H10Z" fill="#09090b" />
          <path d="M25.8 7 20 13l4.1 4.1L34 7h-8.2Z" fill="#7c3aed" />
        </svg>
      </span>
      {!compact && (
        <span className="text-2xl font-black tracking-[-0.04em] text-white">KLYX</span>
      )}
    </Link>
  );
}
