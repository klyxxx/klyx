import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createMobileProfile, getMobileBootstrap, type MobileBootstrap } from "../src/lib/klyx-api";

export default function ProfileScreen() {
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("BE");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [accountType, setAccountType] = useState<"client" | "provider">("client");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getMobileBootstrap().then((value) => {
      setBootstrap(value);
      if (value.profiles.length > 0) router.replace("/assistant");
    }).catch((error) => Alert.alert("KLYX", error instanceof Error ? error.message : "Chargement impossible."));
  }, []);

  async function submit() {
    setBusy(true);
    try {
      await createMobileProfile({ firstName, lastName, city, countryCode, currencyCode, accountType, serviceId });
      router.replace("/phone");
    } catch (error) {
      Alert.alert("Profil impossible", error instanceof Error ? error.message : "Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Ton profil KLYX</Text>
      <TextInput style={styles.input} placeholder="Prénom" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Nom" value={lastName} onChangeText={setLastName} />
      <TextInput style={styles.input} placeholder="Ville" value={city} onChangeText={setCity} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex]} autoCapitalize="characters" maxLength={2} placeholder="Pays" value={countryCode} onChangeText={setCountryCode} />
        <TextInput style={[styles.input, styles.flex]} autoCapitalize="characters" maxLength={3} placeholder="Devise" value={currencyCode} onChangeText={setCurrencyCode} />
      </View>
      <View style={styles.row}>
        {(["client", "provider"] as const).map((type) => (
          <Pressable key={type} style={[styles.choice, accountType === type && styles.choiceActive]} onPress={() => setAccountType(type)}>
            <Text style={accountType === type ? styles.choiceTextActive : styles.choiceText}>{type === "client" ? "Demander" : "Gagner"}</Text>
          </Pressable>
        ))}
      </View>
      {accountType === "provider" ? (
        <View style={styles.services}>
          <Text style={styles.label}>Premier service</Text>
          {(bootstrap?.services ?? []).slice(0, 12).map((service) => (
            <Pressable key={service.id} style={[styles.service, serviceId === service.id && styles.serviceActive]} onPress={() => setServiceId(service.id)}>
              <Text>{service.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable style={styles.primary} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continuer</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 22, gap: 14, backgroundColor: "#fff" },
  heading: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#d9d9de", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  choice: { flex: 1, borderWidth: 1, borderColor: "#d9d9de", borderRadius: 14, padding: 14, alignItems: "center" },
  choiceActive: { backgroundColor: "#111", borderColor: "#111" },
  choiceText: { fontWeight: "700" },
  choiceTextActive: { color: "#fff", fontWeight: "700" },
  services: { gap: 8 },
  label: { fontWeight: "700" },
  service: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e1e1e6" },
  serviceActive: { borderColor: "#111", backgroundColor: "#f3f3f4" },
  primary: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111", marginTop: 6 },
  primaryText: { color: "#fff", fontWeight: "700" },
});
