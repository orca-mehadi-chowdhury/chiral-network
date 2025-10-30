const STORE_FILE = ".keystore.dat";
const PASSWORD_KEY = "auto.keystore.password";
const ADDRESS_KEY = "auto.keystore.address";

type StoreInstance = {
  set: (key: string, value: unknown) => Promise<void>;
  get: (key: string) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
  save: () => Promise<void>;
};

let storePromise: Promise<StoreInstance | null> | null = null;

async function loadStore(): Promise<StoreInstance | null> {
  if (storePromise) {
    return storePromise;
  }

  if (typeof window === "undefined") {
    return null;
  }

  storePromise = (async () => {
    try {
      const { Store } = await import("@tauri-apps/plugin-store");
      return await Store.load(STORE_FILE);
    } catch {
      return null;
    }
  })();

  return storePromise;
}

async function getLocalStorage(): Promise<Storage | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getStoredKeystorePassword(): Promise<string | null> {
  const store = await loadStore();
  if (store) {
    const value = (await store.get(PASSWORD_KEY)) as string | null;
    return value ?? null;
  }

  const local = await getLocalStorage();
  if (local) {
    return local.getItem(PASSWORD_KEY);
  }

  return null;
}

export async function setStoredKeystorePassword(password: string): Promise<void> {
  const store = await loadStore();
  if (store) {
    await store.set(PASSWORD_KEY, password);
    await store.save();
    return;
  }

  const local = await getLocalStorage();
  if (local) {
    local.setItem(PASSWORD_KEY, password);
  }
}

export async function clearStoredKeystorePassword(): Promise<void> {
  const store = await loadStore();
  if (store) {
    await store.delete(PASSWORD_KEY);
    await store.save();
  }

  const local = await getLocalStorage();
  if (local) {
    local.removeItem(PASSWORD_KEY);
  }
}

export async function getStoredKeystoreAddress(): Promise<string | null> {
  const store = await loadStore();
  if (store) {
    const value = (await store.get(ADDRESS_KEY)) as string | null;
    return value ?? null;
  }

  const local = await getLocalStorage();
  if (local) {
    return local.getItem(ADDRESS_KEY);
  }

  return null;
}

export async function setStoredKeystoreAddress(address: string): Promise<void> {
  const store = await loadStore();
  if (store) {
    await store.set(ADDRESS_KEY, address);
    await store.save();
    return;
  }

  const local = await getLocalStorage();
  if (local) {
    local.setItem(ADDRESS_KEY, address);
  }
}

export async function clearStoredKeystoreAddress(): Promise<void> {
  const store = await loadStore();
  if (store) {
    await store.delete(ADDRESS_KEY);
    await store.save();
  }

  const local = await getLocalStorage();
  if (local) {
    local.removeItem(ADDRESS_KEY);
  }
}
