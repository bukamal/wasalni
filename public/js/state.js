const AppState = {
  _cache: {},

  get(key, defaultValue) {
    try {
      const stored = localStorage.getItem('wasalni_' + key);
      if (stored === null || stored === undefined) return defaultValue;
      let value;
      try { value = JSON.parse(stored); } catch { value = stored; }
      if (typeof value === 'string') value = value.replace(/^"(.*)"$/, '$1');
      return value;
    } catch { return defaultValue; }
  },

  set(key, value) {
    try { localStorage.setItem('wasalni_' + key, JSON.stringify(value)); } catch (e) {}
  },

  remove(key) { localStorage.removeItem('wasalni_' + key); },

  clearAll() { ['user_id', 'role', 'onboarding'].forEach(k => this.remove(k)); },

  get userId() { return this.get('user_id', null); },
  set userId(v) { this.set('user_id', v); },

  get role() { return this.get('role', null); },
  set role(v) { this.set('role', v); },

  get onboardingDone() { return this.get('onboarding', null); },
  set onboardingDone(v) { this.set('onboarding', v); }
};
