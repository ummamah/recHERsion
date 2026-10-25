// ============================================================
// Risk assessment engine
// DEMO DATA – not for real-world safety decisions
// ============================================================
import type { RiskZone, Incident, RiskResult } from '../types';

// Time-of-day weights (hour → multiplier)
// Defined in ascending order; matched by current hour
const TIME_WEIGHTS: Array<{ start: number; end: number; weight: number; label: string }> = [
  { start: 0,  end: 4,  weight: 1.8,  label: 'late night (0–4h)' },
  { start: 4,  end: 6,  weight: 1.5,  label: 'early morning (4–6h)' },
  { start: 6,  end: 9,  weight: 0.8,  label: 'morning (6–9h)' },
  { start: 9,  end: 17, weight: 0.6,  label: 'daytime (9–17h)' },
  { start: 17, end: 20, weight: 0.9,  label: 'evening (17–20h)' },
  { start: 20, end: 22, weight: 1.2,  label: 'night (20–22h)' },
  { start: 22, end: 24, weight: 1.6,  label: 'late night (22–24h)' },
];

export function getTimeWeight(): { weight: number; label: string } {
  const hour = new Date().getHours();
  return TIME_WEIGHTS.find(r => hour >= r.start && hour < r.end)
    ?? { weight: 1.0, label: 'unknown time' };
}

/** Haversine distance in metres */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find the highest-risk zone the user is currently inside */
export function findZone(lat: number, lon: number, zones: RiskZone[]): RiskZone | null {
  let worst: RiskZone | null = null;
  let worstRisk = -1;
  for (const z of zones) {
    const dist = haversine(lat, lon, z.lat, z.lon);
    if (dist <= z.radius && z.base_risk > worstRisk) {
      worst = z;
      worstRisk = z.base_risk;
    }
  }
  return worst;
}

/** Decay boost for an incident: 0 at 7 days, 1 at 0 days */
function incidentBoost(dateStr: string, severity: number): number {
  const incDate = new Date(dateStr).getTime();
  const ageMs = Date.now() - incDate;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > 7) return 0;
  const decay = 1 - ageDays / 7;
  return decay * severity * 0.3; // max 0.3 contribution
}

/** Compute risk score for a zone and recent incidents */
export function computeRisk(
  zone: RiskZone | null,
  incidents: Incident[]
): RiskResult {
  const { weight: timeWeight, label: timeLabel } = getTimeWeight();

  if (!zone) {
    const baseScore = 0.25 * timeWeight;
    const capped = Math.min(1, baseScore);
    return {
      score: capped,
      level: capped < 0.4 ? 'low' : capped < 0.65 ? 'medium' : 'high',
      zone: null,
      timeWeight,
      newsBoost: 0,
      explanation: `No specific zone data. General risk estimate for ${timeLabel}.`,
    };
  }

  const newsBoost = incidents
    .filter(i => i.zone_id === zone.id)
    .reduce((sum, i) => sum + incidentBoost(i.date, i.severity), 0);

  const score = Math.min(1, zone.base_risk * timeWeight + newsBoost);
  const level: 'low' | 'medium' | 'high' = score < 0.4 ? 'low' : score < 0.65 ? 'medium' : 'high';

  const recentCount = incidents.filter(i => {
    if (i.zone_id !== zone.id) return false;
    const ageDays = (Date.now() - new Date(i.date).getTime()) / 86400000;
    return ageDays <= 7;
  }).length;

  let explanation = `Zone: ${zone.name}. Base risk: ${Math.round(zone.base_risk * 100)}%. `;
  explanation += `Time multiplier: ×${timeWeight} (${timeLabel}). `;
  if (recentCount > 0) explanation += `${recentCount} recent incident(s) reported nearby. `;
  if (zone.notes) explanation += zone.notes + '.';

  return { score, level, zone, timeWeight, newsBoost, explanation };
}

/** STUB – future live incident feed integration */
export async function fetchLiveIncidents(_zoneId: string): Promise<Incident[]> {
  // NOT IMPLEMENTED – live news APIs require keys and have rate limits.
  // To implement: connect to GDELT or a free crime-data API, parse results,
  // and map them to the Incident format. See LIMITATIONS.md.
  return [];
}
