"use client";

import AssistantThread from "@/app/components/assistant/AssistantThread";

/**
 * Compatibility wrapper kept while `/assistant` moves to the Assistant-first thread.
 * New product work should render AssistantThread directly.
 */
export default function AssistantCommandBar() {
  return <AssistantThread />;
}
