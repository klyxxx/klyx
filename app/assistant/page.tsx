"use client";

import ClientRouteGuard from "@/app/components/ClientRouteGuard";
import AssistantThread from "@/app/components/assistant/AssistantThread";

export default function AssistantHomePage() {
  return (
    <ClientRouteGuard>
      <main className="min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh">
        <AssistantThread />
      </main>
    </ClientRouteGuard>
  );
}
