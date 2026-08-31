import type { ReactNode } from "react";

import styles from "./capabilities.module.css";

export default function ProviderCapabilitiesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.capabilities}>{children}</div>;
}
