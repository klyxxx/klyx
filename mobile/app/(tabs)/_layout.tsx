import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";

import { useAuth } from "@/src/providers/AuthProvider";

const icon = (value: string) => ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 18 }}>{value}</Text>
);

export default function TabsLayout() {
  const { ready, session } = useAuth();
  if (!ready) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0b0b0c" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#0b0b0c", borderTopColor: "#27272a" },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#777",
      }}
    >
      <Tabs.Screen name="assistant" options={{ title: "Assistant", tabBarIcon: icon("◉") }} />
      <Tabs.Screen name="bookings" options={{ title: "Missions", tabBarIcon: icon("▣") }} />
      <Tabs.Screen name="notifications" options={{ title: "Alertes", tabBarIcon: icon("●") }} />
      <Tabs.Screen name="account" options={{ title: "Compte", tabBarIcon: icon("◎") }} />
    </Tabs>
  );
}
