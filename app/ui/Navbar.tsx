import Link from "next/link";
import KlyxLogo from "@/app/ui/KlyxLogo";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <KlyxLogo />

        <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-300 md:flex">
          <a href="#services" className="transition hover:text-white">Services</a>
          <a href="#how-it-works" className="transition hover:text-white">Fonctionnement</a>
          <a href="#trust" className="transition hover:text-white">Confiance</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 sm:inline-flex">
            Connexion
          </Link>
          <Link href="/signup" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200">
            Créer un compte
          </Link>
        </div>
      </div>
    </header>
  );
}
