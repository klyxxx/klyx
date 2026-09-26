import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import {
  loadBookingOverview,
  type BookingOverviewCard,
} from "@/src/lib/klyx-api";

function money(cents: number | null, currency: string) {
  if (cents === null) return "—";
  const code = currency?.trim().toUpperCase() || "EUR";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

export default function BookingsScreen() {
  const [items, setItems] = useState<BookingOverviewCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const payload = await loadBookingOverview();
      setItems(Array.isArray(payload.cards) ? payload.cards : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement impossible.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.page}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(item) => `${item.entityType}:${item.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.muted}>Aucune mission.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.actionRequired && styles.actionCard]}>
            <View style={styles.row}>
              <Text style={styles.id}>{item.serviceLabel}</Text>
              {item.actionRequired ? <Text style={styles.badge}>Action</Text> : null}
            </View>
            <Text style={styles.text}>{item.otherUserName}</Text>
            <Text style={styles.text}>{item.statusLabel}</Text>
            <Text style={styles.text}>{money(item.amountCents, item.currency)}</Text>
            <Text style={styles.muted}>
              {item.dateFrom || "Date à confirmer"}
              {item.slotCount > 1 ? ` · ${item.slotCount} créneaux` : ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#171719",
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionCard: { borderColor: "#5a5a63" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  badge: {
    color: "#fff",
    backgroundColor: "#323238",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "700",
  },
  id: { color: "#fff", fontWeight: "700", flex: 1 },
  text: { color: "#bbb" },
  muted: { color: "#777" },
  error: { color: "#ff7676", padding: 16 },
});
