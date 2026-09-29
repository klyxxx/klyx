import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const COUNT_SUFFIX = ".count";
const CHUNK_SUFFIX = ".part.";

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function storageKey(key: string): string {
  return `klyx.auth.${fnv1a(key)}`;
}

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function storedPartCount(base: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${base}${COUNT_SUFFIX}`, secureOptions);
  const count = raw ? Number.parseInt(raw, 10) : 0;

  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function clearParts(base: string): Promise<void> {
  const count = await storedPartCount(base);

  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(`${base}${CHUNK_SUFFIX}${index}`, secureOptions)
    )
  );

  await SecureStore.deleteItemAsync(`${base}${COUNT_SUFFIX}`, secureOptions);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = storageKey(key);
    const count = await storedPartCount(base);

    if (count === 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${base}${CHUNK_SUFFIX}${index}`, secureOptions)
      )
    );

    if (parts.some((part) => part === null)) {
      await clearParts(base);
      return null;
    }

    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = storageKey(key);
    await clearParts(base);

    const parts: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      parts.push(value.slice(offset, offset + CHUNK_SIZE));
    }

    if (parts.length === 0) parts.push("");

    try {
      for (let index = 0; index < parts.length; index += 1) {
        await SecureStore.setItemAsync(
          `${base}${CHUNK_SUFFIX}${index}`,
          parts[index] ?? "",
          secureOptions
        );
      }

      await SecureStore.setItemAsync(
        `${base}${COUNT_SUFFIX}`,
        String(parts.length),
        secureOptions
      );
    } catch (error) {
      await clearParts(base);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    await clearParts(storageKey(key));
  },
};
