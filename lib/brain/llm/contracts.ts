export type KlyxLlmRole =
  | "system"
  | "user"
  | "assistant";

export type KlyxLlmMessage = {
  role: KlyxLlmRole;
  content: string;
};

export type KlyxBrainIntent =
  | "conversation"
  | "service_request"
  | "recommendation"
  | "memory"
  | "clarification"
  | "unknown";

export type KlyxExecutionAction =
  | "publish_market_request"
  | "select_provider"
  | "create_booking"
  | "create_payment"
  | "refund_payment";

export type KlyxLlmContext = {
  userId?: string | null;
  profileId?: string | null;

  locale?: string | null;

  memory?: Record<string, unknown> | null;

  metadata?: Record<string, unknown> | null;
};

export type KlyxLlmRequest = {
  messages: KlyxLlmMessage[];

  context?: KlyxLlmContext;

  requestedIntent?: KlyxBrainIntent;

  maxOutputCharacters?: number;
};

export type KlyxLlmSafety = {
  automaticExecutionAllowed: false;

  requiresExplicitConfirmation: true;

  forbiddenAutomaticActions: KlyxExecutionAction[];
};

export type KlyxLlmUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type KlyxLlmResponse = {
  provider: string;

  model: string;

  text: string;

  intent: KlyxBrainIntent;

  confidence: number;

  safety: KlyxLlmSafety;

  usage?: KlyxLlmUsage;

  metadata?: Record<string, unknown>;
};

export type KlyxLlmProviderStatus = {
  provider: string;

  configured: boolean;

  available: boolean;

  model: string | null;

  automaticExecutionAllowed: false;
};

export interface KlyxLlmProvider {
  readonly name: string;

  getStatus(): KlyxLlmProviderStatus;

  generate(
    request: KlyxLlmRequest,
  ): Promise<KlyxLlmResponse>;
}