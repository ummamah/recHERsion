// ============================================================
// Geolocation helpers
// ============================================================

export interface GeoFix {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

export type GeoError = 'permission_denied' | 'unavailable' | 'timeout' | 'unsupported';

/** Get a single high-accuracy GPS fix */
export function getCurrentPosition(timeoutMs = 15000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('unsupported' as GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      err => {
        let code: GeoError = 'unavailable';
        if (err.code === 1) code = 'permission_denied';
        else if (err.code === 3) code = 'timeout';
        reject(code);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

export function geoErrorMessage(err: GeoError): string {
  switch (err) {
    case 'permission_denied': return 'Location permission was denied. Please enable it in your browser settings.';
    case 'unavailable':       return 'Your location could not be determined right now.';
    case 'timeout':           return 'Location request timed out. Please try again.';
    case 'unsupported':       return 'This browser does not support location services.';
  }
}

/** Build a pre-filled SOS message string */
export function buildSOSMessage(
  fix: GeoFix | null,
  contactName?: string
): string {
  const greeting = contactName ? `Hi ${contactName},\n` : '';
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const mapLink = fix
    ? `https://www.openstreetmap.org/?mlat=${fix.lat}&mlon=${fix.lon}#map=17/${fix.lat}/${fix.lon}`
    : 'Location unavailable';
  const acc = fix ? ` (±${Math.round(fix.accuracy)}m)` : '';
  return `${greeting}🆘 SAFETY ALERT – I need help!\n\n` +
    `Time: ${now}\n` +
    `Location: ${mapLink}${acc}\n\n` +
    `Please contact me or send help immediately.\n` +
    `— Sent via recHERsion Safety App`;
}

/** Build a journey update message */
export function buildJourneyMessage(
  destination: string,
  fix: GeoFix | null
): string {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const mapLink = fix
    ? `https://www.openstreetmap.org/?mlat=${fix.lat}&mlon=${fix.lon}#map=17/${fix.lat}/${fix.lon}`
    : 'Location unavailable';
  return `📍 Journey update\n\n` +
    `I'm on my way to ${destination}.\n` +
    `Last known location (${now}):\n${mapLink}\n\n` +
    `— Sent via recHERsion Safety App`;
}

export function buildArrivalMessage(destination: string): string {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return `✅ Safe arrival\n\nI've arrived safely at ${destination}.\nTime: ${now}\n\n— Sent via recHERsion Safety App`;
}
