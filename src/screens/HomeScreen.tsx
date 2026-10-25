// ============================================================
// Home screen – four navigation tiles
// ============================================================
import React from 'react';
import { useApp } from '../store/AppContext';
import type { Screen } from '../store/AppContext';

interface Tile {
  id: string;
  icon: string;
  iconClass: string;
  title: string;
  desc: string;
  screen: Screen;
  full?: boolean;
}

const TILES: Tile[] = [
  {
    id: 'tile-sos',
    icon: '🆘',
    iconClass: 'teal',
    title: 'SOS',
    desc: 'Alert your trusted contact with your location',
    screen: 'sos',
    full: true,
  },
  {
    id: 'tile-voice',
    icon: '🎙️',
    iconClass: 'warm',
    title: 'Voice Help',
    desc: 'Trigger SOS with a keyword',
    screen: 'voice_help',
  },
  {
    id: 'tile-journey',
    icon: '🗺️',
    iconClass: 'green',
    title: 'JourneyGuard',
    desc: 'Check in during travel',
    screen: 'journey',
  },
  {
    id: 'tile-risk',
    icon: '📍',
    iconClass: 'teal',
    title: 'Risk Check',
    desc: 'See safety level by location & time',
    screen: 'risk',
  },
  {
    id: 'tile-tracehr',
    icon: '🔍',
    iconClass: 'purple',
    title: 'TraceHer',
    desc: 'Detect patterns in suspicious messages',
    screen: 'tracehr',
  },
];

export function HomeScreen() {
  const { navigate, state } = useApp();

  const sosTile = TILES.find(t => t.id === 'tile-sos')!;
  const otherTiles = TILES.filter(t => t.id !== 'tile-sos');

  const hasActiveJourney = state.journey?.active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-5) var(--space-4) var(--space-4)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div className="row-between">
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>recHERsion</h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Your quiet safety companion
            </p>
          </div>
          <button
            id="btn-settings"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('settings')}
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>

        {hasActiveJourney && (
          <div
            className="info-banner info"
            style={{ marginTop: 'var(--space-3)', cursor: 'pointer' }}
            onClick={() => navigate('journey')}
          >
            <span>🗺️</span>
            <span>
              <strong>Journey active</strong> – tap to check in or view status
            </span>
          </div>
        )}
      </div>

      {/* Tiles */}
      <div className="screen-padded" style={{ paddingTop: 'var(--space-5)' }}>
        {/* SOS – full width */}
        <button
          id={sosTile.id}
          className="tile tile-full"
          onClick={() => navigate(sosTile.screen)}
          aria-label={sosTile.title}
        >
          <div className={`tile-icon`} style={{ background: 'rgba(192,57,43,0.12)', fontSize: 28 }}>
            {sosTile.icon}
          </div>
          <div className="tile-content" style={{ marginLeft: 'var(--space-3)' }}>
            <div className="tile-title" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-sos)' }}>
              {sosTile.title}
            </div>
            <div className="tile-desc">{sosTile.desc}</div>
          </div>
          <span style={{ color: 'var(--color-sos)', fontSize: 'var(--text-xl)' }}>›</span>
        </button>

        {/* 2-column grid */}
        <div className="tile-grid">
          {otherTiles.map(tile => (
            <button
              key={tile.id}
              id={tile.id}
              className="tile"
              onClick={() => navigate(tile.screen)}
              aria-label={tile.title}
            >
              <div className={`tile-icon ${tile.iconClass}`}>{tile.icon}</div>
              <div>
                <div className="tile-title">{tile.title}</div>
                <div className="tile-desc" style={{ marginTop: 4 }}>{tile.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Emergency numbers quick reference */}
        <div className="card" style={{ marginTop: 'var(--space-2)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-3)' }}>
            Emergency numbers
          </p>
          <div className="emergency-list">
            <div className="emergency-item">
              <span className="text-sm">🆘 Emergency (India)</span>
              <a href="tel:112" id="tel-112">Call 112</a>
            </div>
            <div className="emergency-item">
              <span className="text-sm">👮 Police</span>
              <a href="tel:100" id="tel-100">Call 100</a>
            </div>
            <div className="emergency-item">
              <span className="text-sm">🌸 Women's Helpline</span>
              <a href="tel:1091" id="tel-1091">Call 1091</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
