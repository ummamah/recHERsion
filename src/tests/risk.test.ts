// ============================================================
// Tests for the risk score engine
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { getTimeWeight, haversine, findZone, computeRisk } from '../utils/risk';
import type { RiskZone, Incident } from '../types';

// ── Sample data ───────────────────────────────────────────────

const ZONES: RiskZone[] = [
  { id: 'z001', name: 'High Risk Zone', lat: 28.6448, lon: 77.2167, radius: 500, base_risk: 0.8, notes: 'Test' },
  { id: 'z002', name: 'Low Risk Zone',  lat: 28.6300, lon: 77.2100, radius: 300, base_risk: 0.2, notes: 'Test' },
];

const INCIDENTS: Incident[] = [
  { id: 'i1', zone_id: 'z001', date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), severity: 0.8, description: 'Test' },
  { id: 'i2', zone_id: 'z001', date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), severity: 0.9, description: 'Old incident' },
  { id: 'i3', zone_id: 'z002', date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), severity: 0.5, description: 'Test' },
];

// ── haversine ─────────────────────────────────────────────────

describe('haversine', () => {
  it('returns 0 for same point', () => {
    expect(haversine(28.6, 77.2, 28.6, 77.2)).toBe(0);
  });

  it('returns ~111km for 1 degree latitude', () => {
    const dist = haversine(0, 0, 1, 0);
    expect(dist).toBeCloseTo(111195, -2); // within ±100m
  });

  it('returns positive distance', () => {
    const dist = haversine(28.6448, 77.2167, 28.6300, 77.2100);
    expect(dist).toBeGreaterThan(0);
  });
});

// ── findZone ──────────────────────────────────────────────────

describe('findZone', () => {
  it('finds zone when user is inside it', () => {
    // Exactly at zone z001 lat/lon
    const zone = findZone(28.6448, 77.2167, ZONES);
    expect(zone?.id).toBe('z001');
  });

  it('returns null when user is outside all zones', () => {
    const zone = findZone(0, 0, ZONES);
    expect(zone).toBeNull();
  });

  it('returns highest-risk zone when multiple overlap', () => {
    const overlappingZones: RiskZone[] = [
      { id: 'za', name: 'A', lat: 28.6448, lon: 77.2167, radius: 1000, base_risk: 0.5, notes: '' },
      { id: 'zb', name: 'B', lat: 28.6448, lon: 77.2167, radius: 2000, base_risk: 0.9, notes: '' },
    ];
    const zone = findZone(28.6448, 77.2167, overlappingZones);
    expect(zone?.id).toBe('zb');
  });
});

// ── getTimeWeight ─────────────────────────────────────────────

describe('getTimeWeight', () => {
  it('returns highest weight for late night hours', () => {
    // Simulate 2 AM
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(2);
    const { weight } = getTimeWeight();
    expect(weight).toBeGreaterThanOrEqual(1.5);
    vi.restoreAllMocks();
  });

  it('returns lowest weight for daytime hours', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
    const { weight } = getTimeWeight();
    expect(weight).toBeLessThan(1.0);
    vi.restoreAllMocks();
  });

  it('returns a label string', () => {
    const { label } = getTimeWeight();
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

// ── computeRisk ───────────────────────────────────────────────

describe('computeRisk', () => {
  it('returns low level for null zone during daytime', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
    const result = computeRisk(null, []);
    expect(result.level).toBe('low');
    vi.restoreAllMocks();
  });

  it('returns high level for high-risk zone at night', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(2);
    const result = computeRisk(ZONES[0], INCIDENTS);
    expect(result.level).toBe('high');
    expect(result.score).toBeGreaterThan(0.65);
    vi.restoreAllMocks();
  });

  it('adds incident boost for recent incidents', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12); // low time weight
    const withoutIncidents = computeRisk(ZONES[0], []);
    const withIncidents    = computeRisk(ZONES[0], INCIDENTS);
    expect(withIncidents.score).toBeGreaterThan(withoutIncidents.score);
    vi.restoreAllMocks();
  });

  it('old incidents (>7 days) do not add boost', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
    const oldIncidentOnly = INCIDENTS.filter(i => i.id === 'i2'); // 10 days old
    const result = computeRisk(ZONES[0], oldIncidentOnly);
    expect(result.newsBoost).toBe(0);
    vi.restoreAllMocks();
  });

  it('score is always capped at 1', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(2); // highest weight
    const manyIncidents: Incident[] = Array.from({ length: 20 }, (_, i) => ({
      id: `i${i}`, zone_id: 'z001',
      date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      severity: 1.0, description: '',
    }));
    const result = computeRisk(ZONES[0], manyIncidents);
    expect(result.score).toBeLessThanOrEqual(1);
    vi.restoreAllMocks();
  });

  it('returns an explanation string', () => {
    const result = computeRisk(ZONES[0], INCIDENTS);
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(10);
  });
});
