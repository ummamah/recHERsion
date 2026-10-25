// ============================================================
// JourneyGuard screen – check-in based journey monitoring
// Core rule: location is requested ONLY on check-in or SOS
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { useApp } from '../store/AppContext';
import { getCurrentPosition, buildJourneyMessage, buildArrivalMessage } from '../utils/geo';
import type { GeoFix } from '../utils/geo';
import type { JourneyState, CheckInRecord, TrustedContact } from '../types';

// ── Demo route (simulated GPS path) ────────────────────────
const DEMO_ROUTE: Array<{ lat: number; lon: number }> = [
  { lat: 28.6300, lon: 77.2100 },
  { lat: 28.6320, lon: 77.2120 },
  { lat: 28.6340, lon: 77.2145 },
  { lat: 28.6360, lon: 77.2170 },
  { lat: 28.6380, lon: 77.2190 },
];
let demoRouteIdx = 0;

function getDemoFix(): GeoFix {
  const pt = DEMO_ROUTE[demoRouteIdx % DEMO_ROUTE.length];
  demoRouteIdx++;
  return { lat: pt.lat, lon: pt.lon, accuracy: 15, timestamp: Date.now() };
}

// ── Setup form ──────────────────────────────────────────────
interface SetupFormProps {
  savedContact: TrustedContact | null;
  onStart: (j: JourneyState) => void;
}

function SetupForm({ savedContact, onStart }: SetupFormProps) {
  const [dest, setDest] = useState('');
  const [arrivalDate, setArrivalDate] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [interval, setInterval_] = useState(30);
  const [contactName, setContactName] = useState(savedContact?.name ?? '');
  const [contactPhone, setContactPhone] = useState(savedContact?.phone ?? '');
  const [demoMode, setDemoMode] = useState(false);

  function handleStart() {
    const arrivalMs = new Date(arrivalDate).getTime();
    onStart({
      active: true,
      destination: dest.trim(),
      expectedArrival: arrivalMs,
      contact: { name: contactName.trim(), phone: contactPhone.trim() },
      intervalMinutes: demoMode ? 0 : interval,
      lastCheckIn: null,
      status: 'on_track',
      checkIns: [],
      demoMode,
      demoCheckInSeconds: demoMode ? 10 : undefined,
    });
  }

  const valid = dest.trim() && arrivalDate && contactName.trim() && contactPhone.trim();

  return (
    <div className="screen-padded">
      <div className="info-banner info">
        <span>ℹ️</span>
        <span>Set up your journey. The app will remind you to check in and can send your location to your contact if you miss one.</span>
      </div>

      <div className="card">
        <div className="stack stack-4">
          <div className="form-group">
            <label className="form-label" htmlFor="dest-input">Destination</label>
            <input id="dest-input" className="form-input" value={dest}
              onChange={e => setDest(e.target.value)} placeholder="e.g. Mom's house" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="arrival-input">Expected arrival</label>
            <input id="arrival-input" className="form-input" type="datetime-local"
              value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="interval-select">Check-in every</label>
            <select id="interval-select" className="form-input"
              value={interval} onChange={e => setInterval_(Number(e.target.value))}>
              <option value={0}>Only at arrival</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
            </select>
          </div>

          <div className="divider" />

          <div className="form-group">
            <label className="form-label" htmlFor="jcontact-name">Trusted contact</label>
            <input id="jcontact-name" className="form-input" value={contactName}
              onChange={e => setContactName(e.target.value)} placeholder="Contact name" />
            <input id="jcontact-phone" className="form-input" style={{ marginTop: 'var(--space-2)' }}
              type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              placeholder="Phone number" />
          </div>
        </div>
      </div>

      {/* Demo mode toggle */}
      <div className="toggle-row">
        <div className="toggle-label-group">
          <span className="toggle-label">🎭 Demo mode</span>
          <span className="toggle-desc">Simulated GPS · 10-second check-in timer</span>
        </div>
        <label className="toggle-switch">
          <input id="demo-mode-toggle" type="checkbox" checked={demoMode}
            onChange={e => setDemoMode(e.target.checked)} />
          <span className="toggle-track" />
        </label>
      </div>

      <button id="btn-start-journey" className="btn btn-primary btn-full btn-lg"
        onClick={handleStart} disabled={!valid}>
        🗺️ Start journey
      </button>
    </div>
  );
}

// ── Active journey view ─────────────────────────────────────
interface ActiveJourneyProps {
  journey: JourneyState;
  onUpdate: (j: JourneyState) => void;
  onCancel: () => void;
  onArrive: () => void;
}

function ActiveJourney({ journey, onUpdate, onCancel, onArrive }: ActiveJourneyProps) {
  const [now, setNow] = useState(Date.now());
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastFix, setLastFix] = useState<GeoFix | null>(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmArrive, setConfirmArrive] = useState(false);
  const [copied, setCopied] = useState(false);
  const notifFiredRef = useRef(false);

  const intervalSec = journey.demoMode
    ? (journey.demoCheckInSeconds ?? 10)
    : journey.intervalMinutes * 60;

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Check-in overdue detection
  useEffect(() => {
    if (journey.intervalMinutes === 0) return; // "only at arrival" mode
    const reference = journey.lastCheckIn ?? (journey.checkIns[0]?.time ?? Date.now() - 1);
    const elapsed = (Date.now() - reference) / 1000;
    const overdue = elapsed > intervalSec * 1.1;

    if (overdue && journey.status === 'on_track') {
      onUpdate({ ...journey, status: 'missed' });
      // Browser notification
      if (!notifFiredRef.current && Notification.permission === 'granted') {
        notifFiredRef.current = true;
        new Notification('recHERsion – Check-in missed', {
          body: `You missed your check-in for your journey to ${journey.destination}.`,
          icon: '/icons/icon-192.png',
        });
      }
    }

    if (!overdue && journey.status === 'missed') {
      notifFiredRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  async function doCheckIn() {
    setCheckingIn(true);
    let fix: GeoFix | null = null;
    try {
      fix = journey.demoMode ? getDemoFix() : await getCurrentPosition(10000);
      setLastFix(fix);
    } catch { /* no GPS – still count check-in */ }

    const record: CheckInRecord = {
      time: Date.now(),
      lat: fix?.lat,
      lon: fix?.lon,
      note: journey.demoMode ? 'DEMO check-in' : undefined,
    };

    notifFiredRef.current = false;
    onUpdate({
      ...journey,
      lastCheckIn: Date.now(),
      status: 'on_track',
      checkIns: [...journey.checkIns, record],
    });
    setCheckingIn(false);
  }

  // Time-to-next-checkin
  const reference = journey.lastCheckIn ?? (Date.now() - intervalSec * 1000 + 5000);
  const nextCheckIn = reference + intervalSec * 1000;
  const msToNext = nextCheckIn - now;
  const secsToNext = Math.max(0, Math.floor(msToNext / 1000));
  const minsToNext = Math.floor(secsToNext / 60);
  const sToNext = secsToNext % 60;
  const overdue = msToNext < 0 && journey.intervalMinutes !== 0;

  const statusLabel: Record<JourneyState['status'], string> = {
    on_track:     'On track ✓',
    checkin_due:  'Check-in due',
    missed:       'Missed check-in ⚠️',
    arrived:      'Arrived ✓',
    cancelled:    'Cancelled',
  };

  function openSMSWithLocation() {
    const msg = buildJourneyMessage(journey.destination, lastFix);
    const phone = journey.contact.phone.replace(/\D/g, '');
    window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, '_self');
  }

  async function copyLocation() {
    const msg = buildJourneyMessage(journey.destination, lastFix);
    await navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const badgeClass = journey.status === 'on_track' || journey.status === 'arrived'
    ? 'badge-safe'
    : journey.status === 'missed'
    ? 'badge-high'
    : 'badge-medium';

  return (
    <div className="screen-padded">
      {journey.demoMode && (
        <div className="demo-banner">
          🎭 DEMO MODE – Simulated GPS · {journey.demoCheckInSeconds}s check-in timer
        </div>
      )}

      {/* Journey card */}
      <div className="journey-card">
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          <div>
            <p className="text-xs text-muted">Destination</p>
            <p className="font-semibold text-lg">{journey.destination}</p>
          </div>
          <span className={`badge ${badgeClass}`}>{statusLabel[journey.status]}</span>
        </div>

        <div className="row" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
          <div>
            <p className="text-xs text-muted">Expected arrival</p>
            <p className="text-sm font-semibold">
              {new Date(journey.expectedArrival).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {journey.intervalMinutes !== 0 && (
            <div>
              <p className="text-xs text-muted">Next check-in</p>
              <p className={`journey-timer ${overdue ? 'overdue' : ''}`}>
                {overdue
                  ? 'OVERDUE'
                  : `${String(minsToNext).padStart(2, '0')}:${String(sToNext).padStart(2, '0')}`}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted">Check-ins</p>
            <p className="text-sm font-semibold">{journey.checkIns.length}</p>
          </div>
        </div>

        {/* Check-in button */}
        <button
          id="btn-checkin"
          className="btn btn-primary btn-full btn-lg"
          onClick={doCheckIn}
          disabled={checkingIn}
        >
          {checkingIn ? '📡 Getting location…' : '✓ I\'m safe — check in now'}
        </button>

        {lastFix && (
          <p className="text-xs text-muted" style={{ marginTop: 'var(--space-2)', textAlign: 'center' }}>
            Location captured ±{Math.round(lastFix.accuracy)}m
          </p>
        )}
      </div>

      {/* Missed check-in escalation */}
      {journey.status === 'missed' && !showEscalation && (
        <div className="card" style={{ background: '#fff8f8', border: '2px solid var(--color-high)' }}>
          <p className="font-semibold" style={{ color: 'var(--color-high)', marginBottom: 'var(--space-3)' }}>
            ⚠️ You missed your check-in
          </p>
          <p className="text-sm" style={{ marginBottom: 'var(--space-4)' }}>
            Your trusted contact hasn't been notified yet — only you can send an alert.
          </p>
          <button
            id="btn-show-escalation"
            className="btn btn-danger btn-full"
            onClick={() => setShowEscalation(true)}
          >
            View options
          </button>
        </div>
      )}

      {/* Escalation options */}
      {showEscalation && journey.status === 'missed' && (
        <div className="card" style={{ background: '#fff8f8', border: '1.5px solid var(--color-high)' }}>
          <p className="font-semibold" style={{ marginBottom: 'var(--space-4)' }}>What would you like to do?</p>
          <div className="stack stack-3">
            <button id="btn-im-safe" className="btn btn-safe btn-full" onClick={() => {
              setShowEscalation(false);
              onUpdate({ ...journey, status: 'on_track', lastCheckIn: Date.now() });
            }}>
              ✅ I'm safe — cancel alert
            </button>
            <button id="btn-snooze" className="btn btn-secondary btn-full" onClick={() => {
              setShowEscalation(false);
              onUpdate({ ...journey, status: 'on_track', lastCheckIn: Date.now() - (intervalSec * 1000 - 10000) });
            }}>
              ⏱ Snooze 10 minutes
            </button>
            <button id="btn-send-update" className="btn btn-danger btn-full" onClick={openSMSWithLocation}>
              📱 Send update to {journey.contact.name}
            </button>
            <button id="btn-copy-location" className="btn btn-secondary btn-full" onClick={copyLocation}>
              {copied ? '✓ Copied!' : '📋 Copy location message'}
            </button>
          </div>
        </div>
      )}

      {/* Arrival */}
      {!confirmArrive ? (
        <button
          id="btn-arrived"
          className="btn btn-safe btn-full btn-lg"
          onClick={() => setConfirmArrive(true)}
        >
          🏁 I've arrived
        </button>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="font-semibold" style={{ marginBottom: 'var(--space-3)' }}>
            Arrived safely at {journey.destination}? 🎉
          </p>
          <div className="stack stack-3">
            <button id="btn-confirm-arrive" className="btn btn-safe btn-full" onClick={onArrive}>
              Yes — close journey
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => setConfirmArrive(false)}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* Check-in history */}
      {journey.checkIns.length > 0 && (
        <div className="card">
          <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>Check-in log</p>
          <div className="timeline">
            {[...journey.checkIns].reverse().map((ci, i) => (
              <div key={i} className="timeline-item">
                <p className="text-sm font-semibold">
                  {new Date(ci.time).toLocaleTimeString('en-IN')}
                  {ci.note && <span className="badge badge-demo" style={{ marginLeft: 8 }}>{ci.note}</span>}
                </p>
                {ci.lat && (
                  <p className="text-xs text-muted">
                    {ci.lat.toFixed(4)}, {ci.lon?.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel journey */}
      {!confirmCancel ? (
        <button id="btn-cancel-journey" className="btn btn-ghost text-sm text-danger"
          onClick={() => setConfirmCancel(true)}>
          Cancel journey
        </button>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-sm" style={{ marginBottom: 'var(--space-3)' }}>
            Cancel this journey? All check-in data will be cleared.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button id="btn-confirm-cancel" className="btn btn-danger btn-full" onClick={onCancel}>Yes, cancel</button>
            <button className="btn btn-secondary btn-full" onClick={() => setConfirmCancel(false)}>Keep going</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main JourneyGuard screen ────────────────────────────────
export function JourneyScreen() {
  const { state, updateJourney } = useApp();
  const [arrivalMsg, setArrivalMsg] = useState('');
  const [showArrival, setShowArrival] = useState(false);

  const journey = state.journey;

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  function handleArrive() {
    if (!journey) return;
    const msg = buildArrivalMessage(journey.destination);
    setArrivalMsg(msg);
    setShowArrival(true);
    updateJourney({ ...journey, active: false, status: 'arrived' });
  }

  function handleCancel() {
    updateJourney(null);
  }

  function openArrivalSMS() {
    if (!journey) return;
    const phone = journey.contact.phone.replace(/\D/g, '');
    window.open(`sms:${phone}?body=${encodeURIComponent(arrivalMsg)}`, '_self');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar
        title="JourneyGuard"
        subtitle="Check in during travel"
        backTo="home"
      />

      {/* Arrival celebration */}
      {showArrival && (
        <div className="screen-padded">
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontSize: 64, marginBottom: 'var(--space-4)' }}>🎉</div>
            <h2 className="text-xl font-bold" style={{ marginBottom: 'var(--space-2)' }}>
              Arrived safely!
            </h2>
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-5)' }}>
              Would you like to let {journey?.contact.name} know?
            </p>
            <div className="stack stack-3">
              <button id="btn-send-arrival-sms" className="btn btn-primary btn-full" onClick={openArrivalSMS}>
                📱 Send arrival message
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => { setShowArrival(false); updateJourney(null); }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {!showArrival && (
        journey?.active
          ? <ActiveJourney
              journey={journey}
              onUpdate={updateJourney}
              onCancel={handleCancel}
              onArrive={handleArrive}
            />
          : <SetupForm
              savedContact={state.settings.trustedContact}
              onStart={j => updateJourney(j)}
            />
      )}
    </div>
  );
}
