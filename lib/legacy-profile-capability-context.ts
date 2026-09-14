import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export type LegacyProfileCapabilityContext = "request" | "offer";

const legacyProfileCapabilityContext =
  new AsyncLocalStorage<LegacyProfileCapabilityContext>();

export function runWithLegacyProfileCapability<T>(
  capability: LegacyProfileCapabilityContext,
  callback: () => T
): T {
  return legacyProfileCapabilityContext.run(capability, callback);
}

export function getLegacyProfileCapabilityContext():
  | LegacyProfileCapabilityContext
  | undefined {
  return legacyProfileCapabilityContext.getStore();
}
