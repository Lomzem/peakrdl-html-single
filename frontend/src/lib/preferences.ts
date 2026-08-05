export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable for local files or in privacy modes.
  }
}

export function removePreference(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove when storage is unavailable.
  }
}
