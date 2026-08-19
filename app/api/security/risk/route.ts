import { secureApiErrorResponse } from "@/lib/api-error";
import { GET as coreGet, POST as corePost } from "./risk-route-core";

async function secureRiskResponse(
  method: "GET" | "POST",
  run: () => Promise<Response>
) {
  const startedAt = Date.now();

  try {
    const response = await run();

    if (response.status < 500) {
      return response;
    }

    return secureApiErrorResponse({
      error: new Error("Security risk core returned an unexpected 5xx response."),
      event: "security_risk_evaluation_failed",
      route: "/api/security/risk",
      method,
      status: 500,
      code: "KLYX_SECURITY_RISK_EVALUATION_FAILED",
      startedAt,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "security_risk_evaluation_failed",
      route: "/api/security/risk",
      method,
      status: 500,
      code: "KLYX_SECURITY_RISK_EVALUATION_FAILED",
      startedAt,
    });
  }
}

export async function GET(request: Request) {
  return secureRiskResponse("GET", () => coreGet(request));
}

export async function POST(request: Request) {
  return secureRiskResponse("POST", () => corePost(request));
}
