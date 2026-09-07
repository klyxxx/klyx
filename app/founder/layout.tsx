import type { Metadata } from "next";
import Link from "next/link";

import KlyxThemeImage from "@/app/components/KlyxThemeImage";

import "./founder-refresh.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="klyx-founder-shell">
      <header className="klyx-founder-topbar">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-10">
          <Link
            href="/founder"
            aria-label="KLYX Founder"
            className="inline-flex items-center gap-3 rounded-xl font-black tracking-[-0.02em] text-foreground"
          >
            <KlyxThemeImage
              srcLight="/icon.svg"
              srcDark="/apple-icon.svg"
              alt=""
              width={32}
              height={32}
              className="klyx-founder-brand-mark h-8 w-8"
            />
            <span>KLYX</span>
            <span className="text-sm font-bold text-muted-foreground">Founder</span>
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
