// ============================================================
// Shared TypeScript types for the entire app
// ============================================================

export interface TrustedContact {
  name: string;
  phone: string;
}

export interface AppSettings {
  pinHash: string;           // salted SHA-256 hex
  pinSalt: string;           // random hex salt
  trustedContact: TrustedContact | null;
  notificationsEnabled: boolean;
  voiceHelpEnabled: boolean;
  voiceTriggerPhrases: string[];
}

export interface JourneyState {
  active: boolean;
  destination: string;
  expectedArrival: number;   // unix ms
  contact: TrustedContact;
  intervalMinutes: number;   // 0 = only at arrival
  lastCheckIn: number | null;
  status: 'on_track' | 'checkin_due' | 'missed' | 'arrived' | 'cancelled';
  checkIns: CheckInRecord[];
  demoMode: boolean;
  demoCheckInSeconds?: number;
}

export interface CheckInRecord {
  time: number;
  lat?: number;
  lon?: number;
  note?: string;
}

export interface RiskZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  base_risk: number;
  notes: string;
}

export interface Incident {
  id: string;
  zone_id: string;
  date: string;
  severity: number;
  description: string;
}

export interface RiskResult {
  score: number;            // 0–1
  level: 'low' | 'medium' | 'high';
  zone: RiskZone | null;
  explanation: string;
  timeWeight: number;
  newsBoost: number;
}

export type MessageLabel = 'safe' | 'suspicious' | 'threat';

export interface ParsedMessage {
  id: string;
  sender: string;
  timestamp: string;
  text: string;
  url?: string;
  ip?: string;
}

export interface ScoredMessage extends ParsedMessage {
  score: number;
  level: MessageLabel;
  matchedRules: MatchedRule[];
  correction?: MessageLabel | 'unsure';
}

export interface MatchedRule {
  ruleId: string;
  reason: string;
  weight: number;
}

export interface SenderGroup {
  sender: string;
  messages: ScoredMessage[];
  groupScore: number;
  patternBonus: number;
  escalation: number[];
}

export interface EvalMetrics {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
}
