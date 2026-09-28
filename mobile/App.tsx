import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createCheckout,
  getKycStatus,
  getProviderFinance,
  markNotificationRead,
  sendAssistantMessage,
} from "./src/klyx-core";
import {
  listBookings,
  listNotifications,
  type MobileBooking,
  type MobileNotification,
} from "./src/data";
import { launchKlyxIdentityVerification } from "./src/sumsub";
import { KlyxSessionProvider, useKlyxSession } from "./src/session";
import { supabase } from "./src/supabase";
import { t } from "./src/i18n";

type Locale = "fr" | "en" | "nl" | "de";
type Tab = "assistant" | "activity" | "notifications" | "account";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function ActionButton({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (pressed || disabled) && styles.buttonMuted,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LoginScreen() {
  const { signIn } = useKlyxSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.centeredPage}>
      <View style={styles.loginCard}>
        <Text style={styles.brand}>KLYX</Text>
        <Text style={styles.subtitle}>Le même compte que sur le web.</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Mot de passe"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton
          disabled={busy || !email.trim() || !password}
          label={busy ? "Connexion…" : "Se connecter"}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: message,
    };
    setMessages((current) => [...current, userMessage]);
    setText("");
    setBusy(true);
    setError(null);

    try {
      const response = await sendAssistantMessage({ message, conversationId });
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: response.reply,
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assistant indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.chatContent}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.sectionTitle}>Que veux-tu faire ?</Text>
            <Text style={styles.muted}>
              L’assistant mobile utilise le même point d’entrée KLYX que le web.
            </Text>
          </View>
        ) : null}
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              message.role === "user" ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={styles.bubbleText}>{message.text}</Text>
          </View>
        ))}
        {busy ? <ActivityIndicator /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          multiline
          onChangeText={setText}
          placeholder="Demande quelque chose à KLYX"
          style={[styles.input, styles.composerInput]}
          value={text}
        />
        <ActionButton
          disabled={busy || !text.trim()}
          label="Envoyer"
          onPress={() => void send()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function ActivityScreen() {
  const { selectedProfile } = useKlyxSession();
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedProfile) return;
    setError(null);
    try {
      setBookings(await listBookings(selectedProfile.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Réservations indisponibles.");
    }
  }, [selectedProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(booking: MobileBooking) {
    setBusyId(booking.id);
    setError(null);
    try {
      const checkout = await createCheckout(booking.id);
      await Linking.openURL(checkout.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paiement indisponible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Réservations & missions</Text>
        <ActionButton label="Actualiser" onPress={() => void load()} secondary />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {bookings.length === 0 ? (
        <Text style={styles.muted}>Aucune activité pour ce profil.</Text>
      ) : null}
      {bookings.map((booking) => {
        const payable =
          booking.parent_id === selectedProfile?.id &&
          booking.status === "accepted" &&
          booking.payment_status !== "paid";

        return (
          <View key={booking.id} style={styles.card}>
            <Text style={styles.cardTitle}>Réservation {booking.id.slice(0, 8)}</Text>
            <Text style={styles.muted}>
              {booking.booking_date ?? "Date à confirmer"} · {booking.start_time ?? "heure à confirmer"}
            </Text>
            <Text>Mission : {booking.status}</Text>
            <Text>Paiement : {booking.payment_status ?? "non démarré"}</Text>
            {payable ? (
              <ActionButton
                disabled={busyId === booking.id}
                label={busyId === booking.id ? "Préparation…" : "Payer via KLYX"}
                onPress={() => void pay(booking)}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function NotificationsScreen() {
  const { selectedProfile } = useKlyxSession();
  const [items, setItems] = useState<MobileNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedProfile) return;
    try {
      setItems(await listNotifications(selectedProfile.id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifications indisponibles.");
    }
  }, [selectedProfile]);

  useEffect(() => {
    if (!selectedProfile) return;
    void load();

    const channel = supabase
      .channel(`klyx-mobile-notifications-${selectedProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${selectedProfile.id}`,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, selectedProfile]);

  async function markOne(item: MobileNotification) {
    if (!selectedProfile || item.read_at) return;
    try {
      await markNotificationRead({
        profileId: selectedProfile.id,
        notificationId: item.id,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mise à jour impossible.");
    }
  }

  async function markAll() {
    if (!selectedProfile) return;
    try {
      await markNotificationRead({
        profileId: selectedProfile.id,
        markAll: true,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mise à jour impossible.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ActionButton label="Tout lire" onPress={() => void markAll()} secondary />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.length === 0 ? <Text style={styles.muted}>Aucune notification.</Text> : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => void markOne(item)}
          style={[styles.card, !item.read_at && styles.unreadCard]}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.message ? <Text>{item.message}</Text> : null}
          <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function AccountScreen({ locale, setLocale }: { locale: Locale; setLocale(locale: Locale): void }) {
  const {
    bootstrap,
    selectedProfile,
    selectProfile,
    signOut,
  } = useKlyxSession();
  const [status, setStatus] = useState<string | null>(null);
  const [finance, setFinance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadKyc() {
    setBusy(true);
    try {
      setStatus(JSON.stringify(await getKycStatus(), null, 2));
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "KYC indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const result = await launchKlyxIdentityVerification(locale);
      setStatus(JSON.stringify(result, null, 2));
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Vérification indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function loadFinance() {
    setBusy(true);
    try {
      setFinance(JSON.stringify(await getProviderFinance(), null, 2));
    } catch (cause) {
      setFinance(cause instanceof Error ? cause.message : "Finance indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Compte KLYX</Text>
      <Text style={styles.muted}>{bootstrap?.user.email ?? ""}</Text>

      <Text style={styles.label}>Profils</Text>
      {bootstrap?.profiles.map((profile) => (
        <Pressable
          key={profile.id}
          onPress={() => void selectProfile(profile.id)}
          style={[
            styles.profileRow,
            profile.id === selectedProfile?.id && styles.profileRowActive,
          ]}
        >
          <Text style={styles.cardTitle}>
            {profile.firstName} {profile.lastName}
          </Text>
          <Text style={styles.muted}>{profile.legacyAccountType}</Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Langue · Tolgee</Text>
      <View style={styles.rowWrap}>
        {(["fr", "en", "nl", "de"] as Locale[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setLocale(item)}
            style={[styles.localeChip, item === locale && styles.localeChipActive]}
          >
            <Text>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {selectedProfile?.canOfferServices ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prestataire</Text>
          <ActionButton disabled={busy} label="État KYC" onPress={() => void loadKyc()} secondary />
          <ActionButton disabled={busy} label="Vérifier mon identité" onPress={() => void verify()} />
          <ActionButton disabled={busy} label="Finance / ledger" onPress={() => void loadFinance()} secondary />
          {status ? <Text selectable style={styles.codeText}>{status}</Text> : null}
          {finance ? <Text selectable style={styles.codeText}>{finance}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Autorités</Text>
        <Text>Stripe / ledger / eligibility : KLYX Core</Text>
        <Text>Twilio / Resend : KLYX Core</Text>
        <Text>Supabase : session + données autorisées par RLS</Text>
      </View>

      <ActionButton label="Se déconnecter" onPress={() => void signOut()} secondary />
    </ScrollView>
  );
}

function MainApp() {
  const { session, loading, error, selectedProfile } = useKlyxSession();
  const [tab, setTab] = useState<Tab>("assistant");
  const [locale, setLocale] = useState<Locale>("fr");

  const tabLabels = useMemo(
    () => ({
      assistant: t("navigation.Assistant KLYX", "Assistant KLYX", locale),
      activity: t("navigation.Réservations & missions", "Activité", locale),
      notifications: t("navigation.Notifications", "Notifications", locale),
      account: t("navigation.Compte", "Compte", locale),
    }),
    [locale]
  );

  if (loading) {
    return (
      <View style={styles.centeredPage}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Connexion au KLYX Core…</Text>
      </View>
    );
  }

  if (!session) return <LoginScreen />;

  if (!selectedProfile) {
    return (
      <View style={styles.centeredPage}>
        <Text style={styles.error}>{error ?? "Aucun profil KLYX disponible."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <View style={styles.topBar}>
        <Text style={styles.brandSmall}>KLYX</Text>
        <Text numberOfLines={1} style={styles.profileName}>
          {selectedProfile.firstName} {selectedProfile.lastName}
        </Text>
      </View>

      <View style={styles.body}>
        {tab === "assistant" ? <AssistantScreen /> : null}
        {tab === "activity" ? <ActivityScreen /> : null}
        {tab === "notifications" ? <NotificationsScreen /> : null}
        {tab === "account" ? <AccountScreen locale={locale} setLocale={setLocale} /> : null}
      </View>

      <View style={styles.tabBar}>
        {(Object.keys(tabLabels) as Tab[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            onPress={() => setTab(item)}
            style={[styles.tab, item === tab && styles.tabActive]}
          >
            <Text numberOfLines={1} style={styles.tabText}>
              {tabLabels[item]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <KlyxSessionProvider>
      <StatusBar style="auto" />
      <MainApp />
    </KlyxSessionProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#f6f7f8", paddingTop: Platform.OS === "android" ? 34 : 52 },
  body: { flex: 1 },
  centeredPage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#f6f7f8" },
  loginCard: { width: "100%", maxWidth: 460, gap: 14, backgroundColor: "white", padding: 24, borderRadius: 22 },
  brand: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  brandSmall: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 16, color: "#60646c", marginBottom: 8 },
  topBar: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#d8dadd" },
  profileName: { maxWidth: "65%", color: "#60646c" },
  screen: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  chatContent: { padding: 16, gap: 10, flexGrow: 1 },
  emptyState: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  card: { backgroundColor: "white", padding: 16, borderRadius: 18, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "#dedfe2" },
  unreadCard: { borderWidth: 2, borderColor: "#1f2328" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  muted: { color: "#6f737b" },
  error: { color: "#b42318" },
  input: { borderWidth: 1, borderColor: "#c8cbd0", borderRadius: 14, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "white", fontSize: 16 },
  composer: { padding: 12, gap: 8, backgroundColor: "white", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dedfe2" },
  composerInput: { maxHeight: 120 },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#111318" },
  buttonSecondary: { backgroundColor: "#eceef0" },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: "white", fontWeight: "700" },
  buttonTextSecondary: { color: "#111318" },
  bubble: { maxWidth: "88%", padding: 13, borderRadius: 17 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#e3e6ea" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "white" },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  tabBar: { minHeight: 68, flexDirection: "row", backgroundColor: "white", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#d8dadd", paddingBottom: Platform.OS === "ios" ? 10 : 4 },
  tab: { flex: 1, paddingHorizontal: 4, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#eceef0" },
  tabText: { fontSize: 11, fontWeight: "600" },
  label: { marginTop: 10, fontWeight: "700" },
  profileRow: { padding: 14, backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#dedfe2" },
  profileRowActive: { borderColor: "#111318", borderWidth: 2 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  localeChip: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#eceef0", borderRadius: 999 },
  localeChipActive: { borderWidth: 2, borderColor: "#111318" },
  codeText: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11 },
});
