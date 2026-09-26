import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  loadProviderFinance,
  loadProviderOpportunities,
  type ProviderFinancePayload,
  type ProviderOpportunity,
} from "@/src/lib/klyx-api";
import { useProfiles } from "@/src/providers/ProfileProvider";

function money(cents: number, currency: string) {
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

function opportunityBudget(item: ProviderOpportunity) {
  const amount = item.budgetTotal ?? item.budget_max;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "Budget à confirmer";
  const currency = item.currency?.toUpperCase() || "EUR";
  return `${amount.toFixed(2)} ${currency}`;
}

export default function EarnScreen() {
  const { activeProfile } = useProfiles();
  const [opportunities, setOpportunities] = useState<ProviderOpportunity[]>([]);
  const [finance, setFinance] = useState<ProviderFinancePayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const providerMode = activeProfile?.accountType === "provider";

  const load = useCallback(async () => {
    if (!providerMode) {
      setOpportunities([]);
      setFinance(null);
      setError("");
      return;
    }

    setRefreshing(true);
    setError("");
    try {
      const [jobsPayload, financePayload] = await Promise.all([
        loadProviderOpportunities(),
        loadProviderFinance(),
      ]);
      setOpportunities(jobsPayload.requests ?? jobsPayload.jobs ?? []);
      setFinance(financePayload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement impossible.");
    } finally {
      setRefreshing(false);
    }
  }, [providerMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = finance?.summary;
  const reconciliationLabel = useMemo(() => {
    if (!finance) return "—";
    if (!finance.reconciliation) return "Aucun événement à réconcilier";
    return finance.reconciliation.reconciled ? "Réconcilié" : "Vérification requise";
  }, [finance]);

  if (!providerMode) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Gagner avec KLYX</Text>
        <Text style={styles.muted}>
          Sélectionne ton profil prestataire dans Compte pour voir les opportunités et tes finances.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Gagner</Text>
        <Text style={styles.muted}>
          Opportunités et vérité financière fournies par KLYX Core.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Finances</Text>
        {summary ? (
          <>
            <Text style={styles.amount}>
              {money(summary.providerAmountCents, summary.currency)}
            </Text>
            <Text style={styles.muted}>Montant prestataire canonique</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Brut payé</Text>
              <Text style={styles.value}>{money(summary.grossPaidCents, summary.currency)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Commission KLYX</Text>
              <Text style={styles.value}>{money(summary.platformFeeCents, summary.currency)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Remboursé</Text>
              <Text style={styles.value}>{money(summary.refundedCents, summary.currency)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Ledger</Text>
              <Text style={styles.value}>{reconciliationLabel}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.muted}>Aucune donnée financière.</Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Opportunités</Text>
        <Text style={styles.badge}>{opportunities.length}</Text>
      </View>

      {opportunities.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Aucune opportunité éligible pour le moment.</Text>
        </View>
      ) : (
        opportunities.slice(0, 20).map((item) => (
          <View style={styles.card} key={item.id}>
            <Text style={styles.cardTitle}>{item.title || item.service?.name || "Mission"}</Text>
            <Text style={styles.text}>{item.city || "Zone à confirmer"}</Text>
            <Text style={styles.text}>{opportunityBudget(item)}</Text>
            {item.match ? (
              <Text style={styles.muted}>Matching KLYX : {Math.round(item.match.score)}%</Text>
            ) : null}
            {item.liveEligibility?.checked ? (
              <Text style={styles.verified}>Éligibilité live vérifiée par KLYX</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={styles.safety}>
        Le mobile n’autorise ni transfert, ni settlement, ni correction du ledger. Toute décision reste côté serveur.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0b0b0c" },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  centered: {
    flex: 1,
    backgroundColor: "#0b0b0c",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 10,
  },
  header: { gap: 4, marginBottom: 4 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  badge: {
    color: "#d4d4d8",
    backgroundColor: "#242427",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  card: { backgroundColor: "#171719", borderRadius: 18, padding: 16, gap: 7 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  amount: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 6 },
  label: { color: "#9f9fa9", flex: 1 },
  value: { color: "#fff", fontWeight: "600" },
  text: { color: "#d4d4d8" },
  muted: { color: "#8b8b94", lineHeight: 20 },
  verified: { color: "#a7f3d0", marginTop: 2 },
  safety: { color: "#686871", fontSize: 12, lineHeight: 18, marginTop: 8 },
  error: { color: "#ff8585", backgroundColor: "#2a1718", padding: 12, borderRadius: 14 },
});
