import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  converseWithKlyx,
  loadMobileBootstrap,
  type KlyxBootstrap,
  type KlyxProfile,
} from "./src/lib/klyx-api";
import { supabase } from "./src/lib/supabase";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function profileLabel(profile: KlyxProfile): string {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return name || (profile.accountType === "provider" ? "Prestataire" : "Client");
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrap, setBootstrap] = useState<KlyxBootstrap | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Bonjour. Que veux-tu organiser aujourd’hui ?",
    },
  ]);

  const activeProfile = useMemo(
    () => bootstrap?.profiles.find((profile) => profile.id === profileId) ?? null,
    [bootstrap, profileId]
  );

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setBootstrapping(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setBootstrap(null);
        setProfileId(null);
        setConversationId(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setBootstrapping(true);

    void loadMobileBootstrap()
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        setProfileId((current) => {
          if (current && data.profiles.some((profile) => profile.id === current)) {
            return current;
          }
          return data.canonicalProfileId || data.profiles[0]?.id || null;
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          Alert.alert("KLYX", error instanceof Error ? error.message : "Bootstrap impossible.");
        }
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function signIn(): Promise<void> {
    if (!email.trim() || !password) return;
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
    } catch (error) {
      Alert.alert("Connexion", error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signUp(): Promise<void> {
    if (!email.trim() || password.length < 8) {
      Alert.alert("Inscription", "Utilise un email valide et un mot de passe d’au moins 8 caractères.");
      return;
    }
    setAuthBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
      if (!data.session) {
        Alert.alert("KLYX", "Compte créé. Vérifie ton email pour terminer la connexion.");
      }
    } catch (error) {
      Alert.alert("Inscription", error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendMessage(): Promise<void> {
    const clean = message.trim();
    if (!clean || sending || !profileId) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: clean,
    };
    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setSending(true);

    try {
      const response = await converseWithKlyx({
        message: clean,
        conversationId,
        profileId,
        capability: activeProfile?.canOfferServices && !activeProfile.canRequestServices
          ? "provider"
          : "client",
      });
      if (typeof response.conversationId === "string") {
        setConversationId(response.conversationId);
      }
      const reply = typeof response.reply === "string" && response.reply.trim()
        ? response.reply.trim()
        : "KLYX n’a pas produit de réponse exploitable.";
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: reply,
        },
      ]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Assistant indisponible.";
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: `Action bloquée : ${text}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (bootstrapping && !session) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="auto" />
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="auto" />
        <KeyboardAvoidingView
          style={styles.authWrap}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Text style={styles.logo}>KLYX</Text>
          <Text style={styles.subtitle}>Un seul compte. Le même KLYX sur web et mobile.</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="Email"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Mot de passe"
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} onPress={() => void signIn()} disabled={authBusy}>
            <Text style={styles.primaryButtonText}>{authBusy ? "…" : "Se connecter"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void signUp()} disabled={authBusy}>
            <Text style={styles.secondaryButtonText}>Créer un compte</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View>
          <Text style={styles.logoSmall}>KLYX</Text>
          <Text style={styles.profileName}>{activeProfile ? profileLabel(activeProfile) : "Compte KLYX"}</Text>
        </View>
        <Pressable onPress={() => void supabase.auth.signOut()}>
          <Text style={styles.link}>Déconnexion</Text>
        </Pressable>
      </View>

      {bootstrap && bootstrap.profiles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileRow}>
          {bootstrap.profiles.map((profile) => (
            <Pressable
              key={profile.id}
              style={[styles.profileChip, profile.id === profileId && styles.profileChipActive]}
              onPress={() => {
                setProfileId(profile.id);
                setConversationId(null);
              }}
            >
              <Text style={profile.id === profileId ? styles.profileChipTextActive : styles.profileChipText}>
                {profileLabel(profile)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView style={styles.chat} contentContainerStyle={styles.chatContent}>
        {bootstrapping ? <ActivityIndicator /> : null}
        {messages.map((item) => (
          <View
            key={item.id}
            style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={item.role === "user" ? styles.userText : styles.assistantText}>{item.text}</Text>
          </View>
        ))}
        {sending ? <ActivityIndicator style={styles.typing} /> : null}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.composer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Demande quelque chose à KLYX…"
            multiline
            style={styles.composerInput}
          />
          <Pressable
            style={[styles.sendButton, (!message.trim() || sending || !profileId) && styles.buttonDisabled]}
            disabled={!message.trim() || sending || !profileId}
            onPress={() => void sendMessage()}
          >
            <Text style={styles.sendButtonText}>Envoyer</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  authWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  logo: { fontSize: 34, fontWeight: "800", letterSpacing: 2 },
  subtitle: { fontSize: 15, color: "#5f6368", marginBottom: 18 },
  input: { borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  primaryButton: { backgroundColor: "#111111", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#ffffff", fontWeight: "700" },
  secondaryButton: { borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  secondaryButtonText: { color: "#111111", fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#dddddd" },
  logoSmall: { fontSize: 20, fontWeight: "800", letterSpacing: 1.5 },
  profileName: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  link: { fontSize: 13, color: "#4b5563" },
  profileRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  profileChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  profileChipActive: { backgroundColor: "#111111", borderColor: "#111111" },
  profileChipText: { color: "#374151", fontSize: 12 },
  profileChipTextActive: { color: "#ffffff", fontSize: 12 },
  chat: { flex: 1 },
  chatContent: { padding: 16, gap: 12 },
  bubble: { maxWidth: "88%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#111111" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#f2f3f5" },
  userText: { color: "#ffffff", fontSize: 16, lineHeight: 22 },
  assistantText: { color: "#111111", fontSize: 16, lineHeight: 22 },
  typing: { alignSelf: "flex-start", margin: 8 },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dddddd", backgroundColor: "#ffffff" },
  composerInput: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  sendButton: { backgroundColor: "#111111", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  sendButtonText: { color: "#ffffff", fontWeight: "700" },
  buttonDisabled: { opacity: 0.35 },
});
