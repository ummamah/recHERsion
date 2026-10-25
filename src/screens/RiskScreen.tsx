// ============================================================
// RiskScreen – location-based risk factor assessment
// DEMO DATA – not for real-world safety decisions
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { getCurrentPosition } from '../utils/geo';
import { findZone, computeRisk } from '../utils/risk';
import type { RiskZone, Incident, RiskResult } from '../types';

export function RiskScreen() {
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualZone, setManualZone] = useState<string>('');
  const [useManual, setUseManual] = useState(false);
  const [geoErr, setGeoErr] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<ReturnType<typeof import('leaflet').map> | null>(null);

  // Load data files
  useEffect(() => {
    Promise.all([
      fetch('/data/risk-zones.json').then(r => r.json()),
      fetch('/data/incidents.json').then(r => r.json()),
    ]).then(([z, i]) => {
      setZones(z);
      setIncidents(i);
    });
  }, []);

  async function checkWithGPS() {
    setLoading(true);
    setGeoErr('');
    try {
      const fix = await getCurrentPosition(12000);
      const zone = findZone(fix.lat, fix.lon, zones);
      const r = computeRisk(zone, incidents);
      setResult(r);
      renderMap(fix.lat, fix.lon, zone);
    } catch {
      setGeoErr('Location unavailable. Please choose a zone manually below.');
      setUseManual(true);
    } finally {
      setLoading(false);
    }
  }

  function checkManual() {
    const zone = zones.find(z => z.id === manualZone) ?? null;
    const r = computeRisk(zone, incidents);
    setResult(r);
    if (zone) renderMap(zone.lat, zone.lon, zone);
  }

  async function renderMap(lat: number, lon: number, zone: RiskZone | null) {
    if (!mapRef.current) return;
    const L = (await import('leaflet')).default;
    // import leaflet CSS dynamically
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const map = L.map(mapRef.current).setView([lat, lon], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const colour = zone?.base_risk
      ? zone.base_risk > 0.65 ? '#c0392b' : zone.base_risk > 0.4 ? '#c4822a' : '#4a9b8f'
      : '#4a9b8f';

    L.circleMarker([lat, lon], { radius: 10, color: colour, fillColor: colour, fillOpacity: 0.6 })
      .addTo(map)
      .bindPopup(zone?.name ?? 'Your location');

    if (zone) {
      L.circle([zone.lat, zone.lon], { radius: zone.radius, color: colour, fillColor: colour, fillOpacity: 0.1, weight: 2 })
        .addTo(map)
        .bindPopup(zone.name);
    }

    leafletMapRef.current = map;
  }

  const levelColour = result
    ? result.level === 'low' ? 'var(--color-low)' : result.level === 'medium' ? 'var(--color-medium)' : 'var(--color-high)'
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar
        title="Risk Check"
        subtitle="Safety level by location and time"
        backTo="home"
      />

      <div className="screen-padded">
        <div className="demo-banner">
          ⚠️ DEMO DATA — For demonstration only. Not real safety intelligence.
        </div>

        <div className="info-banner info">
          <span>ℹ️</span>
          <span>Score = zone base risk × time multiplier + recent incident boost. Updates with your current location.</span>
        </div>

        {/* GPS check button */}
        {!useManual && (
          <button
            id="btn-check-risk-gps"
            className="btn btn-primary btn-full btn-lg"
            onClick={checkWithGPS}
            disabled={loading || zones.length === 0}
          >
            {loading ? '📡 Getting location…' : '📍 Check my current risk level'}
          </button>
        )}

        {geoErr && (
          <div className="info-banner warn">
            <span>⚠️</span>
            <span>{geoErr}</span>
          </div>
        )}

        {/* Manual zone picker */}
        <div className="card">
          <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>
            Or pick a zone manually
          </p>
          <select
            id="zone-select"
            className="form-input"
            value={manualZone}
            onChange={e => setManualZone(e.target.value)}
          >
            <option value="">Select a demo zone…</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <button
            id="btn-check-risk-manual"
            className="btn btn-secondary btn-full"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={checkManual}
            disabled={!manualZone}
          >
            Check this zone
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="card" style={{ borderLeft: `4px solid ${levelColour}` }}>
            <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
              <div>
                <p className="form-label">Risk level</p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: levelColour, textTransform: 'uppercase' }}>
                  {result.level}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="form-label">Score</p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: levelColour }}>
                  {Math.round(result.score * 100)}%
                </p>
              </div>
            </div>

            {/* Meter */}
            <div className="risk-meter" style={{ marginBottom: 'var(--space-4)' }}>
              <div
                className="risk-meter-fill"
                style={{
                  width: `${result.score * 100}%`,
                  background: levelColour,
                }}
              />
            </div>

            <p className="text-sm" style={{ lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
              {result.explanation}
            </p>

            <div className="divider" />

            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <p className="text-xs text-muted">Time weight</p>
                <p className="text-sm font-semibold">×{result.timeWeight}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Incident boost</p>
                <p className="text-sm font-semibold">+{(result.newsBoost * 100).toFixed(0)}%</p>
              </div>
              {result.zone && (
                <div>
                  <p className="text-xs text-muted">Base risk</p>
                  <p className="text-sm font-semibold">{Math.round(result.zone.base_risk * 100)}%</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map */}
        {result && (
          <div
            ref={mapRef}
            className="map-container"
            id="risk-map"
            style={{ height: 260 }}
          />
        )}
      </div>
    </div>
  );
}
