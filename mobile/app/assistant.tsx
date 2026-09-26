import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { absoluteKlyxUrl, converse, type AssistantReply } from "../src/lib/klyx-api";
import { supabase } from "../src/lib/supabase";

type Message = { id: string; role: "user" | "assistant"; text: string; action?: AssistantReply["payload"] extends infer P ? P : never };

type AssistantAction = { href?: string; label?: string; kind?: string };

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Bonjour. Dis-moi ce que tu veux faire : trouver un service, gagner de l'argent avec tes compétences, ou gérer une mission." },
  ]);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<AssistantAction | null>(null);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: value }]);
    setBusy(true);
    try {
      const result = await converse(value, conversationId);
      if (result.conversationId) setConversationId(result.conversationId);
      const action = result.payload?.assistantAction ?? null;
      setLastAction(action && typeof action === "object" ? action as AssistantAction : null);
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", text: result.reply?.trim() || "Je n'ai pas de réponse exploitable pour le moment." }]);
    } catch (error) {
      Alert.alert("KLYX indisponible", error instanceof Error ? error.message : "Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function openAction() {
    if (!lastAction?.href) return;
    const url = absoluteKlyxUrl(lastAction.href);
    if (!url.startsWith("https://www.klyx.be/") && url !== "https://www.klyx.be") {
      Alert.alert("Action bloquée", "KLYX refuse une destination externe non certifiée.");
      return;
    }
    await Linking.openURL(url);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.push("/phone")}><Text style={styles.topLink}>Téléphone</Text></Pressable>
        <Pressable onPress={signOut}><Text style={styles.topLink}>Déconnexion</Text></Pressable>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            <Text style={item.role === "user" ? styles.userText : styles.assistantText}>{item.text}</Text>
          </View>
        )}
      />
      {lastAction?.href ? (
        <Pressable style={styles.action} onPress={openAction}>
          <Text style={styles.actionText}>{lastAction.label || "Continuer"}</Text>
        </Pressable>
      ) : null}
      <View style={styles.composer}>
        <TextInput style={styles.input} placeholder="Écris à KLYX…" value={text} onChangeText={setText} multiline />
        <Pressable style={styles.send} onPress={send} disabled={busy || !text.trim()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Envoyer</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  topbar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e4e4e7" },
  topLink: { fontWeight: "600" },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  bubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#111" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#f1f1f3" },
  userText: { color: "#fff", lineHeight: 20 },
  assistantText: { color: "#111", lineHeight: 20 },
  action: { marginHorizontal: 16, marginBottom: 8, padding: 13, borderWidth: 1, borderColor: "#111", borderRadius: 14, alignItems: "center" },
  actionText: { fontWeight: "700" },
  composer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#e4e4e7" },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: "#d9d9de", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  send: { minWidth: 78, borderRadius: 16, backgroundColor: "#111", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  sendText: { color: "#fff", fontWeight: "700" },
});
