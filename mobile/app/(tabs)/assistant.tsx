import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { sendAssistantMessage } from "@/src/lib/klyx-api";
import { useProfiles } from "@/src/providers/ProfileProvider";

type Message = { id: string; role: "user" | "assistant"; text: string };

export default function AssistantScreen() {
  const { activeProfile } = useProfiles();
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Que veux-tu organiser aujourd’hui ?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", text: message };
    setMessages((items) => [...items, userMessage]);

    try {
      const response = await sendAssistantMessage({ message, conversationId });
      setConversationId(response.conversationId);
      setMessages((items) => [
        ...items,
        { id: `a-${Date.now()}`, role: "assistant", text: response.reply },
      ]);
    } catch (cause) {
      setMessages((items) => [
        ...items,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: cause instanceof Error ? cause.message : "KLYX est indisponible.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.page}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>KLYX</Text>
        <Text style={styles.profile}>{activeProfile?.firstName ?? "Profil"}</Text>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            <Text style={styles.message}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          editable={!busy}
          multiline
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Demande quelque chose à KLYX…"
          placeholderTextColor="#777"
          style={styles.input}
          value={input}
        />
        <Pressable onPress={send} style={styles.send}><Text style={styles.sendText}>↑</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c" },
  header: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" },
  brand: { color: "#fff", fontWeight: "800", fontSize: 19 },
  profile: { color: "#aaa" },
  list: { padding: 16, gap: 12 },
  bubble: { maxWidth: "88%", borderRadius: 18, padding: 14 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#26262a" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#151517" },
  message: { color: "#f4f4f5", fontSize: 16, lineHeight: 23 },
  composer: { padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-end" },
  input: { flex: 1, minHeight: 50, maxHeight: 140, backgroundColor: "#1b1b1e", color: "#fff", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 13 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  sendText: { color: "#000", fontSize: 24, fontWeight: "700" },
});
