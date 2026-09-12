"use client";

import AssistantThread from "@/app/components/assistant/AssistantThread";

import styles from "./assistant-shell.module.css";

export default function AssistantHomePage() {
  return (
    <main
      className={`${styles.shell} min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh`}
    >
      <AssistantThread />
    </main>
  );
}
