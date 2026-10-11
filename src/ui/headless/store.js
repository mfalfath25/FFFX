/**
 * Headless Parameter State Store
 * Manages reactive parameter states across all effects with subscriptions,
 * batching, presets, and serialization.
 */

export class ParameterStore {
  constructor(initialValues = {}) {
    this.values = { ...initialValues };
    this.listeners = new Set();
    this.effectListeners = new Map(); // effectId -> Set of callbacks
  }

  /**
   * Initializes values for an effect if not already present
   */
  initEffect(effectId, defaultValues = {}) {
    if (!this.values[effectId]) {
      this.values[effectId] = { ...defaultValues };
    } else {
      this.values[effectId] = { ...defaultValues, ...this.values[effectId] };
    }
  }

  /**
   * Retrieves all values for a given effect
   */
  getEffectValues(effectId) {
    if (!this.values[effectId]) {
      this.values[effectId] = {};
    }
    return this.values[effectId];
  }

  /**
   * Gets a specific parameter value
   */
  get(effectId, key, fallback = null) {
    const effectVals = this.values[effectId];
    if (effectVals && key in effectVals && effectVals[key] !== undefined) {
      return effectVals[key];
    }
    return fallback;
  }

  /**
   * Sets a specific parameter value and notifies listeners
   */
  set(effectId, key, value, silent = false) {
    if (!this.values[effectId]) {
      this.values[effectId] = {};
    }
    const prev = this.values[effectId][key];
    if (prev === value) return;

    this.values[effectId][key] = value;

    if (!silent) {
      this.notify(effectId, key, value, prev);
    }
  }

  /**
   * Batch update multiple parameters
   */
  batchSet(effectId, updates = {}, silent = false) {
    if (!this.values[effectId]) {
      this.values[effectId] = {};
    }
    Object.assign(this.values[effectId], updates);

    if (!silent) {
      this.notify(effectId, '*', updates, null);
    }
  }

  /**
   * Subscribes to changes for a specific effect
   */
  subscribeEffect(effectId, callback) {
    if (!this.effectListeners.has(effectId)) {
      this.effectListeners.set(effectId, new Set());
    }
    this.effectListeners.get(effectId).add(callback);
    return () => {
      const set = this.effectListeners.get(effectId);
      if (set) set.delete(callback);
    };
  }

  /**
   * Subscribes to global changes across all effects
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifies subscribers of changes
   */
  notify(effectId, key, value, prev) {
    const payload = { effectId, key, value, prev, timestamp: performance.now() };
    this.listeners.forEach((fn) => fn(payload));
    const effectSet = this.effectListeners.get(effectId);
    if (effectSet) {
      effectSet.forEach((fn) => fn(payload));
    }
  }

  /**
   * Exports entire state as JSON string
   */
  serialize() {
    return JSON.stringify(this.values, null, 2);
  }

  /**
   * Imports parameters from serialized JSON
   */
  deserialize(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      Object.assign(this.values, parsed);
      this.notify('*', '*', parsed, null);
      return true;
    } catch (err) {
      console.error('Failed to deserialize parameter store:', err);
      return false;
    }
  }
}

export const globalParameterStore = new ParameterStore();
