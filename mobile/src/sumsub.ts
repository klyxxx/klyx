import SNSMobileSDK from "@sumsub/react-native-mobilesdk-module";

import { createSumsubSdkToken } from "./klyx-core";

export async function launchKlyxIdentityVerification(locale = "fr") {
  const initial = await createSumsubSdkToken();

  const sdk = SNSMobileSDK.init(initial.token, async () => {
    const refreshed = await createSumsubSdkToken();
    return refreshed.token;
  })
    .withLocale(locale)
    .withDebug(false)
    .build();

  return sdk.launch();
}
