import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  loadMobileNotifications,
  markNotificationRead,
  type MobileNotification,
} from "@/src/lib/klyx-api";

export default function NotificationsScreen() {
  const [items, setItems] = useState<MobileNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const payload = await loadMobileNotifications();
      setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement impossible.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(async (item: MobileNotification) => {
    if (item.readAt) return;
    try {
      await markNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mise à jour impossible.");
    }
  }, []);

  return (
    <View style={styles.page}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.muted}>Aucune notification.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => void markRead(item)}>
            <View style={[styles.card, !item.readAt && styles.unread]}>
              <Text style={styles.title}>{item.title ?? "KLYX"}</Text>
              <Text style={styles.message}>{item.message ?? ""}</Text>
              {!item.readAt ? <Text style={styles.badge}>Nouveau</Text> : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c" },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: "#171719",
    borderRadius: 16,
    padding: 15,
    opacity: 0.72,
    borderWidth: 1,
    borderColor: "transparent",
  },
  unread: { opacity: 1, borderColor: "#3f3f46" },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  message: { color: "#b8b8bd", lineHeight: 20 },
  badge: { color: "#a7f3d0", fontSize: 12, fontWeight: "700", marginTop: 8 },
  muted: { color: "#777", textAlign: "center", marginTop: 40 },
  error: { color: "#ff7676", padding: 16 },
});
