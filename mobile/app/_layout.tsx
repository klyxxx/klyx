import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerBackTitle: "Retour",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: "KLYX" }} />
        <Stack.Screen name="profile" options={{ title: "Créer mon profil" }} />
        <Stack.Screen name="phone" options={{ title: "Téléphone" }} />
        <Stack.Screen name="assistant" options={{ title: "KLYX" }} />
      </Stack>
    </>
  );
}
