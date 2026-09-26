import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/providers/AuthProvider";
import { I18nProvider } from "@/src/providers/I18nProvider";
import { ProfileProvider } from "@/src/providers/ProfileProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <ProfileProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ProfileProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
