/**
 * Headless Control Group Model
 * Manages groups of controls and their accordion/collapse states.
 */

export class GroupManager {
  constructor() {
    this.collapsedState = new Map(); // key -> boolean
    this.listeners = new Set();
  }

  isCollapsed(groupKey, defaultCollapsed = false) {
    if (this.collapsedState.has(groupKey)) {
      return this.collapsedState.get(groupKey);
    }
    return defaultCollapsed;
  }

  setCollapsed(groupKey, collapsed) {
    this.collapsedState.set(groupKey, collapsed);
    this.notify(groupKey, collapsed);
  }

  toggle(groupKey, defaultCollapsed = false) {
    const current = this.isCollapsed(groupKey, defaultCollapsed);
    this.setCollapsed(groupKey, !current);
    return !current;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(groupKey, collapsed) {
    this.listeners.forEach((fn) => fn({ groupKey, collapsed }));
  }
}

export const globalGroupManager = new GroupManager();
