import type { ReactNode } from "react";

import "../klyx-auth-visual.css";

export default function SignupLayout({ children }: { children: ReactNode }) {
  return <div className="klyx-auth-page">{children}</div>;
}
