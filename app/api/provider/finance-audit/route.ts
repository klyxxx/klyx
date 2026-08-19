import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet } from "./finance-audit-route-core";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Provider finance audit core returned an unexpected 5xx response."),
      event: "provider_finance_audit_failed",
      route: "/api/provider/finance-audit",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_FINANCE_AUDIT_FAILED",
      startedAt,
      details: {
        automaticExecutionAllowed: false,
      },
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "provider_finance_audit_failed",
      route: "/api/provider/finance-audit",
      method: "GET",
      status: 500,
      code: "KLYX_PROVIDER_FINANCE_AUDIT_FAILED",
      startedAt,
      details: {
        automaticExecutionAllowed: false,
      },
    });
  }
}
