import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/src/providers/AuthProvider";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      router.replace("/(tabs)/assistant");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.logo}>KLYX</Text>
        <Text style={styles.title}>Ton assistant de services</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#777"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          placeholder="Mot de passe"
          placeholderTextColor="#777"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy} onPress={submit} style={styles.button}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Continuer</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c", justifyContent: "center", padding: 24 },
  card: { gap: 14 },
  logo: { color: "#fff", fontSize: 28, fontWeight: "800" },
  title: { color: "#b8b8bd", fontSize: 18, marginBottom: 12 },
  input: { backgroundColor: "#18181b", color: "#fff", borderRadius: 16, padding: 16, fontSize: 16 },
  error: { color: "#ff7676" },
  button: { backgroundColor: "#fff", borderRadius: 16, padding: 16, alignItems: "center" },
  buttonText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
