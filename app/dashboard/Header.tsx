import NotificationBell from "./NotificationBell";

type HeaderProps = {
  email: string;
  displayName?: string;
};

export default function Header({
  email,
  displayName,
}: HeaderProps) {
  return (
    <header>
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-violet-600 dark:text-violet-400">
        KLYX
      </p>

      <h1 className="text-3xl font-bold text-foreground">
        Tableau de bord
      </h1>

      <p className="mt-1 text-muted-foreground">
        Bienvenue{displayName ? `, ${displayName}` : ""}.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="max-w-[260px] truncate rounded-full border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          {email || "Utilisateur"}
        </div>

        <NotificationBell />
      </div>
    </header>
  );
}