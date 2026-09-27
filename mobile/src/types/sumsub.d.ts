declare module "@sumsub/react-native-mobilesdk-module" {
  export type SNSMobileSDKResult = {
    success: boolean;
    status: string;
    errorType?: string;
    errorMsg?: string;
  };

  type SNSMobileSDKInstance = {
    launch(): Promise<SNSMobileSDKResult>;
    dismiss(): void;
  };

  type SNSMobileSDKBuilder = {
    withLocale(locale: string): SNSMobileSDKBuilder;
    withDebug(enabled: boolean): SNSMobileSDKBuilder;
    build(): SNSMobileSDKInstance;
  };

  const SNSMobileSDK: {
    init(
      accessToken: string,
      tokenExpirationHandler: () => Promise<string>
    ): SNSMobileSDKBuilder;
  };

  export default SNSMobileSDK;
}
