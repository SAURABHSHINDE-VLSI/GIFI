export type EffectsPrefs = {
  noiseSuppression: boolean;
};

export const DEFAULT_EFFECTS_PREFS: EffectsPrefs = {
  noiseSuppression: true,
};

export const STORAGE_KEY_EFFECTS = "herz:effects";

export function validateEffectsPrefs(parsed: unknown): EffectsPrefs {
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_EFFECTS_PREFS };
  }
  const candidate = parsed as Record<string, unknown>;
  const noiseSuppression =
    typeof candidate.noiseSuppression === "boolean"
      ? candidate.noiseSuppression
      : DEFAULT_EFFECTS_PREFS.noiseSuppression;

  return { noiseSuppression };
}

export function loadPrefs(): EffectsPrefs {
  if (typeof window === "undefined") {
    return { ...DEFAULT_EFFECTS_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_EFFECTS);
    if (!raw) {
      return { ...DEFAULT_EFFECTS_PREFS };
    }
    const parsed = JSON.parse(raw);
    return validateEffectsPrefs(parsed);
  } catch {
    return { ...DEFAULT_EFFECTS_PREFS };
  }
}

export function savePrefs(prefs: EffectsPrefs): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const validated = validateEffectsPrefs(prefs);
    window.localStorage.setItem(STORAGE_KEY_EFFECTS, JSON.stringify(validated));
  } catch {
    // Ignore storage write failures (quota exceeded, private mode)
  }
}

export const STORAGE_KEY_AUTOPIP = "herz:autopip";

export function loadAutoPipPref(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_AUTOPIP);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return true;
  } catch {
    return true;
  }
}

export function saveAutoPipPref(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY_AUTOPIP, enabled ? "1" : "0");
  } catch {
    // Ignore storage write failures
  }
}

export const STORAGE_KEY_WATCHSYNC = "herz:watchsync";

export function loadWatchSyncPref(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_WATCHSYNC);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
    return true; // default enabled
  } catch {
    return true;
  }
}

export function saveWatchSyncPref(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY_WATCHSYNC, enabled ? "1" : "0");
  } catch {
    // Ignore storage write failures
  }
}
