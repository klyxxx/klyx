import type { ReactNode } from "react";

import styles from "./skills.module.css";

export default function ProviderSkillsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.skills}>{children}</div>;
}
