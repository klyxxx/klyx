export const KLYX_ASSISTANT_MESSAGE_MAX_LENGTH = 5000;

export function isKlyxAssistantMessageTooLong(value: string): boolean {
  return value.trim().length > KLYX_ASSISTANT_MESSAGE_MAX_LENGTH;
}
