import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getPhoneStatus,
  savePhoneNumber,
  sendPhoneOtp,
  verifyPhoneOtp,
  type MobilePhoneStatus,
} from "./klyx-core";

export function PhoneSettingsCard({ profileId }: { profileId: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<MobilePhoneStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await getPhoneStatus();
      setStatus(next);
      setPhone(next.phoneNumber ?? "");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Téléphone indisponible.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [profileId]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await savePhoneNumber(phone);
      setStatus(next);
      setPhone(next.phoneNumber ?? "");
      setCode("");
      setMessage("Numéro enregistré. Demande maintenant le code de vérification.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendPhoneOtp();
      if (result.alreadyVerified || result.verified) {
        await refresh();
        setMessage("Numéro déjà vérifié.");
      } else {
        setMessage(`Code envoyé${result.maskedPhone ? ` au ${result.maskedPhone}` : ""}.`);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Envoi du code impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await verifyPhoneOtp(code);
      if (!result.verified) {
        throw new Error("Vérification refusée.");
      }
      setCode("");
      await refresh();
      setMessage("Téléphone vérifié.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Vérification impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Téléphone</Text>
          <Text style={styles.muted}>
            {status?.verified ? "Vérifié" : "À vérifier"}
          </Text>
        </View>
        {busy ? <ActivityIndicator /> : null}
      </View>

      <TextInput
        autoComplete="tel"
        editable={!busy}
        keyboardType="phone-pad"
        onChangeText={setPhone}
        placeholder="+32471503513"
        style={styles.input}
        value={phone}
      />

      <Pressable disabled={busy || !phone.trim()} onPress={() => void save()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Enregistrer le numéro</Text>
      </Pressable>

      {!status?.verified && status?.phoneNumber ? (
        <>
          <Pressable disabled={busy} onPress={() => void sendCode()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Envoyer le code</Text>
          </Pressable>
          <TextInput
            editable={!busy}
            keyboardType="number-pad"
            maxLength={10}
            onChangeText={setCode}
            placeholder="Code OTP"
            style={styles.input}
            value={code}
          />
          <Pressable disabled={busy || code.length < 4} onPress={() => void verify()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Vérifier</Text>
          </Pressable>
        </>
      ) : null}

      {status?.verifiedAt ? (
        <Text style={styles.muted}>Vérifié le {new Date(status.verifiedAt).toLocaleDateString()}</Text>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 18,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dedfe2",
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "700" },
  muted: { color: "#6f737b", fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#c8cbd0",
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "white",
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111318",
    paddingHorizontal: 14,
  },
  primaryText: { color: "white", fontWeight: "700" },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eceef0",
    paddingHorizontal: 14,
  },
  secondaryText: { color: "#111318", fontWeight: "700" },
  message: { color: "#475467", fontSize: 13, lineHeight: 18 },
});
