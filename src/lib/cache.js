// @ts-check

export class MemoryCache {
  constructor() {
    /** @type {Map<string, { expiresAt: number, value: unknown }>} */
    this.store = new Map();
  }

  /**
   * @template T
   * @param {string} key
   * @returns {T | null}
   */
  get(key) {
    const record = this.store.get(key);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return /** @type {T} */ (record.value);
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} ttlMs
   */
  set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
}
