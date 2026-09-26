import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/src/lib/supabase";

type Booking = {
  id: string;
  service_status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

export default function BookingsScreen() {
  const [items, setItems] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("bookings")
        .select("id, service_status, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (queryError) throw queryError;
      setItems((data ?? []) as Booking[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement impossible.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={styles.page}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.muted}>Aucune mission.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.id}>Mission {item.id.slice(0, 8)}</Text>
            <Text style={styles.text}>Service : {item.service_status ?? "—"}</Text>
            <Text style={styles.text}>Paiement : {item.payment_status ?? "—"}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#171719", borderRadius: 18, padding: 16, gap: 6 },
  id: { color: "#fff", fontWeight: "700" },
  text: { color: "#bbb" },
  muted: { color: "#777", textAlign: "center", marginTop: 40 },
  error: { color: "#ff7676", padding: 16 },
});
