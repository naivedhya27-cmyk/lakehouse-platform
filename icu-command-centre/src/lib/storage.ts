// Thin localStorage wrapper. Used to persist orders, acknowledged alerts and
// nursing notes so the demo state survives a refresh and the bedside layer
// keeps working without network.

const PREFIX = "icu-cc:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota or private mode — fail silently
  }
}
