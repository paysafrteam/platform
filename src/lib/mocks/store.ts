import { createSeedStore } from "@/lib/mocks/seed";
import type { AppStore, Order } from "@/lib/domain/types";

const STORAGE_KEY = "paysafr-demo-store-v1";

export function getStore(): AppStore {
  if (typeof window === "undefined") return createSeedStore();
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const seed = createSeedStore();
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(saved) as AppStore;
  } catch (error) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    throw new Error("The demo session could not be read. Reset the demo store and try again.", {
      cause: error,
    });
  }
}

export function updateStore<T>(mutate: (store: AppStore) => T): T {
  const store = getStore();
  const result = mutate(store);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  return result;
}

export function resetStore(): AppStore {
  const seed = createSeedStore();
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  }
  return seed;
}

export function findOrderByToken(token: string): Order | undefined {
  return getStore().orders.find((order) => order.token === token);
}

export function findOrderById(id: string): Order | undefined {
  return getStore().orders.find((order) => order.id === id);
}
