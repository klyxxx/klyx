import type {
  ReactNode,
} from "react";

import ClientRouteGuard from "@/app/components/ClientRouteGuard";

export default function MarketClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClientRouteGuard>
      {children}
    </ClientRouteGuard>
  );
}