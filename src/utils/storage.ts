// ============================================================
// localStorage helpers – typed wrappers
// ============================================================
import type { AppSettings, JourneyState } from '../types';

const KEYS = {
  settings:  'rh_settings',
  journey:   'rh_journey',
  corrections: 'rh_corrections',
} as const;

// ── Generic ────────────────────────────────────────────────

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('localStorage write failed', e);
  }
}

function remove(key: string): void {
  localStorage.removeItem(key);
}

// ── Settings ───────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  pinHash: '',
  pinSalt: '',
  trustedContact: null,
  notificationsEnabled: false,
  voiceHelpEnabled: false,
  voiceTriggerPhrases: ['help me', 'save me'],
};

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(load<AppSettings>(KEYS.settings) ?? {}) };
}

export function saveSettings(settings: AppSettings): void {
  save(KEYS.settings, settings);
}

export function isFirstLaunch(): boolean {
  const s = load<AppSettings>(KEYS.settings);
  return !s || !s.pinHash;
}

// ── Journey ────────────────────────────────────────────────

export function loadJourney(): JourneyState | null {
  return load<JourneyState>(KEYS.journey);
}

export function saveJourney(j: JourneyState): void {
  save(KEYS.journey, j);
}

export function clearJourney(): void {
  remove(KEYS.journey);
}

// ── Corrections ────────────────────────────────────────────

export type CorrectionMap = Record<string, string>;

export function loadCorrections(): CorrectionMap {
  return load<CorrectionMap>(KEYS.corrections) ?? {};
}

export function saveCorrection(msgId: string, correction: string): void {
  const map = loadCorrections();
  map[msgId] = correction;
  save(KEYS.corrections, map);
}

// ── Reset ──────────────────────────────────────────────────

export function resetAllData(): void {
  Object.values(KEYS).forEach(k => remove(k));
}
