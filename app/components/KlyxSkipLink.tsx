"use client";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";

export default function KlyxSkipLink() {
  const { t } = useKlyxLocale();

  return (
    <a
      href="#klyx-main-content"
      className="klyx-skip-link"
    >
      {t("skipToMain")}
    </a>
  );
}
