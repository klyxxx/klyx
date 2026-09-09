/**
 * Shared visible product capacity for every client Assistant entry point.
 * Keep this aligned with the hardened Brain HTTP boundary (4,000 characters).
 */
export const KLYX_ASSISTANT_MESSAGE_MAX_LENGTH = 4000;

export function isKlyxAssistantMessageTooLong(value: string): boolean {
  return value.trim().length > KLYX_ASSISTANT_MESSAGE_MAX_LENGTH;
}
