import type { ReactNode } from "react";

import styles from "./verification.module.css";

export default function ProviderVerificationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.verification}>{children}</div>;
}
