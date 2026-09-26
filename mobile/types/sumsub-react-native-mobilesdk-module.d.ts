declare module "@sumsub/react-native-mobilesdk-module" {
  type TokenExpirationHandler = () => Promise<string>;

  type SumsubSdk = {
    launch(): Promise<unknown>;
  };

  type SumsubBuilder = {
    build(): SumsubSdk;
  };

  const SNSMobileSDK: {
    init(accessToken: string, onTokenExpired: TokenExpirationHandler): SumsubBuilder;
  };

  export default SNSMobileSDK;
}
