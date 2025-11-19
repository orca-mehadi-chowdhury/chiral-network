import { DEFAULT_RELAY_LIST } from "$lib/constants/network";

type MutableSettings = Record<string, any> | null | undefined;

export function ensureRelayDefaults<T extends MutableSettings>(settings: T): T {
  if (!settings || typeof settings !== "object") {
    return settings;
  }

  const target = settings as Record<string, any>;

  if (
    !Array.isArray(target.preferredRelays) ||
    target.preferredRelays.length === 0
  ) {
    target.preferredRelays = [...DEFAULT_RELAY_LIST];
  }

  if (
    !Array.isArray(target.customBootstrapNodes) ||
    target.customBootstrapNodes.length === 0
  ) {
    target.customBootstrapNodes = [...DEFAULT_RELAY_LIST];
  }

  if (target.enableAutorelay === false || typeof target.enableAutorelay !== "boolean") {
    target.enableAutorelay = true;
  }

  if (target.enableAutonat === false || typeof target.enableAutonat !== "boolean") {
    target.enableAutonat = true;
  }

  return settings;
}
