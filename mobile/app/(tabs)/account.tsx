import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/providers/AuthProvider";
import { useI18n } from "@/src/providers/I18nProvider";
import { useProfiles } from "@/src/providers/ProfileProvider";

export default function AccountScreen() {
  const { signOut } = useAuth();
  const { locale, setLocale } = useI18n();
  const { profiles, activeProfile, switchProfile } = useProfiles();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Profils KLYX</Text>
      {profiles.map((profile) => (
        <Pressable
          key={profile.id}
          onPress={() => void switchProfile(profile.id)}
          style={[styles.card, profile.id === activeProfile?.id && styles.active]}
        >
          <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
          <Text style={styles.meta}>{profile.accountType} · {profile.city || "—"}</Text>
        </Pressable>
      ))}

      <Text style={styles.heading}>Langue</Text>
      <View style={styles.row}>
        {(["fr", "en", "nl", "de"] as const).map((value) => (
          <Pressable key={value} onPress={() => setLocale(value)} style={[styles.pill, locale === value && styles.active]}>
            <Text style={styles.pillText}>{value.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace("/login");
        }}
        style={styles.logout}
      >
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#0b0b0c", flexGrow: 1, padding: 16, gap: 12 },
  heading: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: "#171719", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "transparent" },
  active: { borderColor: "#fff" },
  name: { color: "#fff", fontWeight: "700" },
  meta: { color: "#999", marginTop: 4 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: { borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: "#171719", borderWidth: 1, borderColor: "transparent" },
  pillText: { color: "#fff", fontWeight: "700" },
  logout: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: "#251515", alignItems: "center" },
  logoutText: { color: "#ff9a9a", fontWeight: "700" },
});
