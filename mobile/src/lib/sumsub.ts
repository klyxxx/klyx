import SNSMobileSDK from "@sumsub/react-native-mobilesdk-module";

import { apiFetch } from "@/src/lib/klyx-api";

type SumsubTokenResponse = {
  token?: string;
  accessToken?: string;
};

async function fetchSumsubToken(): Promise<string> {
  const payload = await apiFetch<SumsubTokenResponse>("/api/provider/sumsub/token", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const value = payload.token ?? payload.accessToken ?? "";
  if (!value) throw new Error("Jeton Sumsub indisponible.");
  return value;
}

export async function launchKlyxVerification() {
  let currentToken = await fetchSumsubToken();

  const sdk = SNSMobileSDK.init(currentToken, async () => {
    currentToken = await fetchSumsubToken();
    return currentToken;
  }).build();

  return sdk.launch();
}
