export type BackgroundMode = "off" | "blur-light" | "blur-strong";

export type EffectsPrefs = {
  background: BackgroundMode;
  noiseSuppression: boolean;
};

export const DEFAULT_EFFECTS_PREFS: EffectsPrefs = {
  background: "off",
  noiseSuppression: true,
};

export const STORAGE_KEY_EFFECTS = "herz:effects";

export function getBlurRadius(mode: BackgroundMode): number {
  switch (mode) {
    case "blur-light":
      return 10;
    case "blur-strong":
      return 20;
    case "off":
    default:
      return 0;
  }
}

export function validateBackgroundMode(val: unknown): BackgroundMode {
  if (val === "off" || val === "blur-light" || val === "blur-strong") {
    return val;
  }
  return DEFAULT_EFFECTS_PREFS.background;
}

export function validateEffectsPrefs(parsed: unknown): EffectsPrefs {
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_EFFECTS_PREFS };
  }
  const candidate = parsed as Record<string, unknown>;
  const background = validateBackgroundMode(candidate.background);
  const noiseSuppression =
    typeof candidate.noiseSuppression === "boolean"
      ? candidate.noiseSuppression
      : DEFAULT_EFFECTS_PREFS.noiseSuppression;

  return { background, noiseSuppression };
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
