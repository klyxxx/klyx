import type { ReactNode } from "react";

import "../klyx-accounts-visual.css";

export default function AccountsLayout({ children }: { children: ReactNode }) {
  return <div className="klyx-accounts-page">{children}</div>;
}
