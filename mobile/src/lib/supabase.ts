import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { mobileConfig } from "@/src/config";

const CHUNK_SIZE = 512;
const MANIFEST_SUFFIX = ".klyx-manifest";
const CHUNK_SUFFIX = ".klyx-chunk";

const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

function manifestKey(key: string) {
  return `${key}${MANIFEST_SUFFIX}`;
}

function chunkKey(key: string, index: number) {
  return `${key}${CHUNK_SUFFIX}.${index}`;
}

async function readChunkCount(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(manifestKey(key));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { version?: unknown; chunks?: unknown };
    if (
      parsed.version === 1 &&
      Number.isSafeInteger(parsed.chunks) &&
      Number(parsed.chunks) >= 1 &&
      Number(parsed.chunks) <= 128
    ) {
      return Number(parsed.chunks);
    }
  } catch {
    // Corrupt secure-session metadata fails closed below.
  }

  return 0;
}

async function removeChunkedValue(key: string) {
  const count = await readChunkCount(key);
  if (count && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index))
      )
    );
  }

  await SecureStore.deleteItemAsync(manifestKey(key));
  await SecureStore.deleteItemAsync(key);
}

const storage = {
  async getItem(key: string) {
    const count = await readChunkCount(key);

    if (count === null) {
      return SecureStore.getItemAsync(key);
    }

    if (count === 0) {
      await removeChunkedValue(key);
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index))
      )
    );

    if (chunks.some((chunk) => chunk === null)) {
      await removeChunkedValue(key);
      return null;
    }

    return chunks.join("");
  },

  async setItem(key: string, value: string) {
    await removeChunkedValue(key);

    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }

    if (chunks.length === 0) chunks.push("");

    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(chunkKey(key, index), chunks[index], secureStoreOptions);
    }

    await SecureStore.setItemAsync(
      manifestKey(key),
      JSON.stringify({ version: 1, chunks: chunks.length }),
      secureStoreOptions
    );
  },

  async removeItem(key: string) {
    await removeChunkedValue(key);
  },
};

export const supabase = createClient(
  mobileConfig.supabaseUrl,
  mobileConfig.supabasePublishableKey,
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

function applyRefreshState(state: string) {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
}

applyRefreshState(AppState.currentState);
AppState.addEventListener("change", applyRefreshState);
