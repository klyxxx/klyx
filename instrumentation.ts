import { reportKlyxUnhandledRequestError } from "@/lib/elmah-io";

type KlyxInstrumentationRequest = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type KlyxInstrumentationContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
};

export async function onRequestError(
  error: unknown,
  request: KlyxInstrumentationRequest,
  context: KlyxInstrumentationContext
): Promise<void> {
  await reportKlyxUnhandledRequestError({
    error,
    method: request.method,
    routePath: context.routePath,
    routerKind: context.routerKind,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
}
