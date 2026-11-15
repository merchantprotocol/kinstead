/** Small wrapper over localStorage so a blocked or full storage never breaks the deck. */
export class PreferenceStore {
  constructor(storage, prefix) { this.storage = storage; this.prefix = prefix; }

  get(key, fallback) {
    try { const value = this.storage.getItem(this.prefix + key); return value === null ? fallback : value; }
    catch { return fallback; }
  }

  set(key, value) { try { this.storage.setItem(this.prefix + key, String(value)); } catch { /* storage unavailable */ } }
}
