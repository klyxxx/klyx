import type { ReactNode } from "react";

import styles from "./profile-layout.module.css";

export default function ProfileLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div
      data-testid="profile-scroll-region"
      className={`${styles.scrollRegion} min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain`}
    >
      {children}
    </div>
  );
}
