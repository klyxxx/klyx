import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { getPhone, savePhone, sendPhoneOtp, verifyPhoneOtp } from "../src/lib/klyx-api";

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPhone().then((value) => {
      setPhoneNumber(value.phoneNumber ?? "");
      setVerified(value.verified);
    }).catch(() => undefined);
  }, []);

  async function requestCode() {
    setBusy(true);
    try {
      await savePhone(phoneNumber);
      await sendPhoneOtp();
      Alert.alert("Code envoyé", "Entre le code reçu par SMS.");
    } catch (error) {
      Alert.alert("SMS impossible", error instanceof Error ? error.message : "Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const result = await verifyPhoneOtp(code);
      setVerified(result.verified);
      if (result.verified) router.replace("/assistant");
    } catch (error) {
      Alert.alert("Code refusé", error instanceof Error ? error.message : "Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Vérifier ton téléphone</Text>
      <Text style={styles.note}>Le SMS n'est envoyé qu'après ton action. Aucun envoi automatique payant.</Text>
      <TextInput style={styles.input} keyboardType="phone-pad" placeholder="+324..." value={phoneNumber} onChangeText={setPhoneNumber} editable={!verified} />
      {verified ? (
        <Text style={styles.success}>Téléphone vérifié.</Text>
      ) : (
        <>
          <Pressable style={styles.secondary} onPress={requestCode} disabled={busy}>
            <Text style={styles.secondaryText}>Envoyer le code</Text>
          </Pressable>
          <TextInput style={styles.input} keyboardType="number-pad" placeholder="Code OTP" value={code} onChangeText={setCode} />
          <Pressable style={styles.primary} onPress={verify} disabled={busy || !code.trim()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Vérifier</Text>}
          </Pressable>
        </>
      )}
      <Pressable onPress={() => router.replace("/assistant")}>
        <Text style={styles.link}>Continuer vers KLYX</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 22, gap: 14, backgroundColor: "#fff" },
  heading: { fontSize: 25, fontWeight: "800" },
  note: { color: "#60646c", lineHeight: 20 },
  input: { borderWidth: 1, borderColor: "#d9d9de", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  primary: { minHeight: 48, borderRadius: 14, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#d9d9de", alignItems: "center", justifyContent: "center" },
  secondaryText: { fontWeight: "700" },
  success: { fontWeight: "700" },
  link: { textAlign: "center", textDecorationLine: "underline", marginTop: 8 },
});
