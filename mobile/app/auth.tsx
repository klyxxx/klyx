import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../src/lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.replace("/");
    } catch (error) {
      Alert.alert("Connexion impossible", error instanceof Error ? error.message : "Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) {
        router.replace("/profile");
      } else {
        Alert.alert("Compte créé", "Vérifie ton e-mail puis connecte-toi.");
      }
    } catch (error) {
      Alert.alert("Création impossible", error instanceof Error ? error.message : "Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>KLYX</Text>
        <Text style={styles.subtitle}>Un seul assistant pour organiser tes services.</Text>
        <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} secureTextEntry placeholder="Mot de passe" value={password} onChangeText={setPassword} />
        <Pressable style={styles.primary} onPress={signIn} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Se connecter</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={signUp} disabled={busy}>
          <Text style={styles.secondaryText}>Créer un compte</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f7f7f8" },
  card: { gap: 14, padding: 22, borderRadius: 24, backgroundColor: "#fff" },
  title: { fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#5f6368", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#d9d9de", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  primary: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d9d9de" },
  secondaryText: { fontWeight: "700" },
});
