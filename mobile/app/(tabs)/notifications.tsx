import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/src/lib/supabase";

type NotificationRow = {
  id: string;
  title: string | null;
  message: string | null;
  read_at: string | null;
  created_at: string | null;
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, title, message, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems((data ?? []) as NotificationRow[]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load().catch(() => undefined); }, [load]);

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.muted}>Aucune notification.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read_at && styles.unread]}>
            <Text style={styles.title}>{item.title ?? "KLYX"}</Text>
            <Text style={styles.message}>{item.message ?? ""}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c" },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: "#171719", borderRadius: 16, padding: 15, opacity: 0.72 },
  unread: { opacity: 1 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  message: { color: "#b8b8bd", lineHeight: 20 },
  muted: { color: "#777", textAlign: "center", marginTop: 40 },
});
