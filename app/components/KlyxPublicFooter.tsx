import Link from "next/link";

const links = [
  { href: "/privacy", label: "Confidentialité" },
  { href: "/terms", label: "Conditions" },
  { href: "/support", label: "Assistance" },
  { href: "/delete-account", label: "Supprimer un compte" },
];

export default function KlyxPublicFooter() {
  return (
    <footer className="mt-12 border-t border-border py-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-3 px-4 text-xs font-semibold text-muted-foreground">
        <span>© {new Date().getFullYear()} KLYX</span>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
