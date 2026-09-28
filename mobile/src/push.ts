import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  registerPushInstallation,
  unregisterPushInstallation,
} from "./klyx-core";

const INSTALLATION_KEY = "klyx.mobile.push-installation-id";
const CHANNEL_ID = "klyx-default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function nativePlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return Platform.OS;
  }
  return null;
}

function permissionGranted(
  status: Notifications.NotificationPermissionsStatus
): boolean {
  if (status.granted) return true;

  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function installationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (existing) return existing;

  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALLATION_KEY, created);
  return created;
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "KLYX",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (permissionGranted(current)) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return permissionGranted(requested);
}

async function registerTokenData(tokenData: unknown): Promise<boolean> {
  const platform = nativePlatform();
  if (!platform || typeof tokenData !== "string" || tokenData.length < 16) {
    return false;
  }

  await registerPushInstallation({
    installationId: await installationId(),
    platform,
    token: tokenData,
  });
  return true;
}

export async function registerNativePush(): Promise<
  "registered" | "permission-denied" | "unsupported"
> {
  if (!nativePlatform()) return "unsupported";
  if (!(await ensurePermission())) return "permission-denied";

  const token = await Notifications.getDevicePushTokenAsync();
  const registered = await registerTokenData(token.data);
  return registered ? "registered" : "unsupported";
}

export function subscribeNativePushTokenRefresh(): () => void {
  const subscription = Notifications.addPushTokenListener((token) => {
    void registerTokenData(token.data).catch(() => undefined);
  });

  return () => subscription.remove();
}

export async function unregisterNativePush(): Promise<void> {
  const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!id) return;
  await unregisterPushInstallation(id);
}
