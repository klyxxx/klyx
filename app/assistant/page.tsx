"use client";

import AssistantCommandBar from "@/app/components/AssistantCommandBar";
import ClientRouteGuard from "@/app/components/ClientRouteGuard";

export default function AssistantHomePage() {
  return (
    <ClientRouteGuard>
      <main className="min-h-[calc(100vh-3.5rem)] px-4 pb-28 pt-14 sm:px-6 sm:pt-24 lg:min-h-screen lg:px-10 lg:pb-12 lg:pt-28">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
          <h1 className="max-w-3xl text-center text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
            Que dois-je organiser pour vous ?
          </h1>

          <div className="mt-8 w-full max-w-3xl sm:mt-10">
            <AssistantCommandBar />
          </div>
        </div>
      </main>
    </ClientRouteGuard>
  );
}
