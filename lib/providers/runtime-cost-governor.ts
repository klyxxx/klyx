import type { KlyxExternalProviderName } from "./contracts";
import {
  KlyxProviderControlPlane,
  executeWithKlyxProviderControlPlane,
} from "./control-plane";
import type {
  KlyxProviderExecutionAdapter,
  KlyxProviderExecutionOutcome,
  KlyxProviderOperationKind,
  KlyxProviderRetrySafety,
} from "./control-plane-contracts";
import { createKlyxCostAwareProviderControlPlaneRegistry } from "./control-plane-registry";
import { logServerWarning } from "@/lib/server-log";

let singleton: KlyxProviderControlPlane | null = null;

function createRuntimeControlPlane(): KlyxProviderControlPlane {
  return new KlyxProviderControlPlane(
    createKlyxCostAwareProviderControlPlaneRegistry(),
    {
      audit: (event) => {
        if (
          event.action !== "blocked" &&
          event.action !== "budget_threshold_reached" &&
          event.action !== "circuit_opened"
        ) {
          return;
        }

        logServerWarning({
          event: "external_cost_control",
          route: "provider-cost-control",
          code: [
            event.provider,
            event.action,
            event.reasonCode ?? "none",
          ].join(":"),
        });
      },
    }
  );
}

export function getKlyxRuntimeProviderControlPlane(): KlyxProviderControlPlane {
  if (!singleton) {
    singleton = createRuntimeControlPlane();
  }

  return singleton;
}

export function resetKlyxRuntimeProviderControlPlaneForTests(): void {
  singleton = null;
}

export type KlyxRuntimeProviderCallInput<TInput, TOutput> = {
  provider: KlyxExternalProviderName;
  capability: string;
  operation: string;
  kind: KlyxProviderOperationKind;
  retrySafety: KlyxProviderRetrySafety;
  idempotencyKey?: string;
  estimatedCostMinor?: number;
  costCurrency?: string;
  payload: TInput;
  adapter: KlyxProviderExecutionAdapter<TInput, TOutput>;
  actualCost?: (
    value: TOutput
  ) => { minor: number; currency: string } | undefined;
};

export async function executeKlyxRuntimeProviderCall<TInput, TOutput>(
  input: KlyxRuntimeProviderCallInput<TInput, TOutput>
): Promise<TOutput> {
  const result: KlyxProviderExecutionOutcome<TOutput> =
    await executeWithKlyxProviderControlPlane({
      controlPlane: getKlyxRuntimeProviderControlPlane(),
      adapter: input.adapter,
      operation: {
        capability: input.capability,
        operation: input.operation,
        kind: input.kind,
        retrySafety: input.retrySafety,
        idempotencyKey: input.idempotencyKey,
        estimatedCostMinor: input.estimatedCostMinor,
        costCurrency: input.costCurrency,
      },
      payload: input.payload,
      actualCost: input.actualCost,
    });

  if (result.ok) {
    return result.value;
  }

  throw new Error(
    "KLYX_EXTERNAL_PROVIDER_GUARD:" +
      result.provider +
      ":" +
      result.code
  );
}
