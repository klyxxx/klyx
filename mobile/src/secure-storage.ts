import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const META_SUFFIX = ".chunks";

function metaKey(key: string) {
  return `${key}${META_SUFFIX}`;
}

async function removeChunks(key: string): Promise<void> {
  const rawCount = await SecureStore.getItemAsync(metaKey(key));
  const count = Number(rawCount ?? 0);

  if (Number.isFinite(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${index}`)
      )
    );
  }

  await SecureStore.deleteItemAsync(metaKey(key));
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const rawCount = await SecureStore.getItemAsync(metaKey(key));
    const count = Number(rawCount ?? 0);

    if (!Number.isFinite(count) || count <= 0) {
      return SecureStore.getItemAsync(key);
    }

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${key}.${index}`)
      )
    );

    if (chunks.some((chunk) => chunk === null)) {
      return null;
    }

    return chunks.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.${index}`, chunk)
      )
    );
    await SecureStore.setItemAsync(metaKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await removeChunks(key);
  },
};
