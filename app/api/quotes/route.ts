import { after } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { sendKlyxProfileTransactionalEmail } from "@/lib/email/resend";
import {
  quoteAcceptedEmail,
  quoteCancelledEmail,
  quoteRejectedEmail,
  quoteRequestedEmail,
  quoteSentEmail,
} from "@/lib/email/templates";
import {
  quoteLifecycleQualificationPreflight,
  quoteTransactionQualificationPreflight,
} from "@/lib/quote-transaction-qualification-preflight";
import { logServerWarning } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  GET as coreGet,
  PATCH as corePatch,
  POST as corePost,
} from "./quote-route-core";

type QuoteMethod = "GET" | "POST" | "PATCH";
type QuoteLifecycleEmailAction =
  | "send"
  | "accept"
  | "reject"
  | "cancel";

type QuoteLifecycleEmailTarget = {
  client_profile_id: string;
  provider_profile_id: string;
};

function quoteLifecycleEmail(
  action: QuoteLifecycleEmailAction,
  quote: QuoteLifecycleEmailTarget,
  quoteId: string
) {
  if (action === "send") {
    return {
      profileId: quote.client_profile_id,
      ...quoteSentEmail(quoteId),
    };
  }

  if (action === "accept") {
    return {
      profileId: quote.provider_profile_id,
      ...quoteAcceptedEmail(),
    };
  }

  if (action === "reject") {
    return {
      profileId: quote.provider_profile_id,
      ...quoteRejectedEmail(),
    };
  }

  return {
    profileId: quote.provider_profile_id,
    ...quoteCancelledEmail(),
  };
}

async function secureCoreResponse(
  response: Response,
  method: QuoteMethod,
  startedAt: number
): Promise<Response> {
  if (response.status < 500) {
    return response;
  }

  let error: unknown = new Error("Quote operation failed.");

  try {
    const payload = (await response.clone().json()) as {
      error?: unknown;
    };

    if (typeof payload.error === "string" && payload.error.trim()) {
      error = new Error(payload.error);
    }
  } catch {
    // The public 5xx response is replaced below; parsing failure is non-fatal.
  }

  const operation =
    method === "GET"
      ? "load"
      : method === "POST"
        ? "create"
        : "update";

  return secureApiErrorResponse({
    error,
    event: `quotes_${operation}_failed`,
    route: "/api/quotes",
    method,
    status: response.status,
    code: `KLYX_QUOTES_${operation.toUpperCase()}_FAILED`,
    startedAt,
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const response = await coreGet(request);
    return secureCoreResponse(response, "GET", startedAt);
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "quotes_load_failed",
      route: "/api/quotes",
      method: "GET",
      status: 500,
      code: "KLYX_QUOTES_LOAD_FAILED",
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const emailRequest = request.clone();

  try {
    const preflight = await quoteTransactionQualificationPreflight(
      request.clone()
    );

    if (preflight) return preflight;

    const response = await corePost(request);
    const securedResponse = await secureCoreResponse(
      response,
      "POST",
      startedAt
    );

    if (securedResponse.ok) {
      const emailBody = (await emailRequest
        .json()
        .catch(() => null)) as {
        providerProfileId?: unknown;
      } | null;
      const providerProfileId =
        typeof emailBody?.providerProfileId === "string"
          ? emailBody.providerProfileId.trim()
          : "";

      if (providerProfileId) {
        after(async () => {
          await sendKlyxProfileTransactionalEmail({
            profileId: providerProfileId,
            ...quoteRequestedEmail(),
          });
        });
      }
    }

    return securedResponse;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "quotes_create_failed",
      route: "/api/quotes",
      method: "POST",
      status: 500,
      code: "KLYX_QUOTES_CREATE_FAILED",
      startedAt,
    });
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();
  const emailRequest = request.clone();

  try {
    const preflight = await quoteLifecycleQualificationPreflight(
      request.clone()
    );

    if (preflight) return preflight;

    const response = await corePatch(request);
    const securedResponse = await secureCoreResponse(
      response,
      "PATCH",
      startedAt
    );

    if (securedResponse.ok) {
      const emailBody = (await emailRequest
        .json()
        .catch(() => null)) as {
        quoteId?: unknown;
        action?: unknown;
      } | null;
      const quoteId =
        typeof emailBody?.quoteId === "string"
          ? emailBody.quoteId.trim()
          : "";
      const action =
        typeof emailBody?.action === "string"
          ? emailBody.action.trim()
          : "";
      const isEmailAction = [
        "send",
        "accept",
        "reject",
        "cancel",
      ].includes(action);

      if (quoteId && isEmailAction) {
        after(async () => {
          const { data: quote, error: quoteError } =
            await supabaseAdmin
              .from("service_quotes")
              .select(
                "client_profile_id, provider_profile_id"
              )
              .eq("id", quoteId)
              .maybeSingle();

          if (quoteError || !quote) {
            logServerWarning({
              event: "quote_lifecycle_email_lookup_failed",
              route: "/api/quotes",
              method: "PATCH",
              code: "KLYX_QUOTE_EMAIL_LOOKUP_FAILED",
            });
            return;
          }

          const email = quoteLifecycleEmail(
            action as QuoteLifecycleEmailAction,
            quote as QuoteLifecycleEmailTarget,
            quoteId
          );

          await sendKlyxProfileTransactionalEmail(email);
        });
      }
    }

    return securedResponse;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "quotes_update_failed",
      route: "/api/quotes",
      method: "PATCH",
      status: 500,
      code: "KLYX_QUOTES_UPDATE_FAILED",
      startedAt,
    });
  }
}
