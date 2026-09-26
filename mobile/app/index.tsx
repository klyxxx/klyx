import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";

const DEFAULT_ORIGIN = "https://www.klyx.be";
const INTERNAL_HOSTS = new Set(["www.klyx.be", "klyx.be"]);
const EMBEDDED_PROVIDER_SUFFIXES = [
  ".stripe.com",
  ".stripe.network",
  ".sumsub.com",
  ".supabase.co",
];

function configuredOrigin(): string {
  const candidate = process.env.EXPO_PUBLIC_KLYX_WEB_ORIGIN?.trim();
  if (!candidate) return DEFAULT_ORIGIN;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return DEFAULT_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

function isEmbeddedNavigation(url: string, appHost: string): boolean {
  if (url === "about:blank") return true;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === appHost || INTERNAL_HOSTS.has(parsed.hostname)) {
      return true;
    }

    return EMBEDDED_PROVIDER_SUFFIXES.some(
      (suffix) =>
        parsed.hostname.endsWith(suffix) ||
        parsed.hostname === suffix.slice(1)
    );
  } catch {
    return false;
  }
}

export default function KlyxMobileHome() {
  const webViewRef = useRef<WebView>(null);
  const origin = useMemo(configuredOrigin, []);
  const host = useMemo(() => new URL(origin).hostname, [origin]);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!canGoBack) return false;
        webViewRef.current?.goBack();
        return true;
      }
    );

    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigation = (request: WebViewNavigation) => {
    if (isEmbeddedNavigation(request.url, host)) return true;

    if (request.url.startsWith("https://")) {
      void Linking.openURL(request.url);
    }

    return false;
  };

  if (failed) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>KLYX est momentanément indisponible</Text>
        <Text style={styles.body}>
          Vérifie ta connexion puis réessaie. Aucune action financière n’est rejouée automatiquement.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            setFailed(false);
            setReloadKey((value) => value + 1);
          }}
        >
          <Text style={styles.buttonText}>Réessayer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: origin }}
        originWhitelist={["https://*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
          </View>
        )}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onShouldStartLoadWithRequest={handleNavigation}
        onError={() => setFailed(true)}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) setFailed(true);
        }}
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", opacity: 0.72 },
  button: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#111111",
  },
  buttonText: { color: "#ffffff", fontWeight: "700" },
});
