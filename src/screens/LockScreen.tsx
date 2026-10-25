// ============================================================
// LockScreen – every launch + 2-minute inactivity
// ============================================================
import React, { useState, useEffect } from 'react';
import { Numpad } from '../components/Numpad';
import { verifyPin } from '../utils/crypto';
import { loadSettings, resetAllData } from '../utils/storage';
import { useApp } from '../store/AppContext';

const MAX_ATTEMPTS = 3;
const DELAY_MS = 5000;

export function LockScreen() {
  const { unlock } = useApp();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const maxLen = 6;

  useEffect(() => {
    if (!locked || countdown <= 0) return;
    const t = setTimeout(() => {
      setCountdown(c => {
        if (c <= 1) { setLocked(false); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [locked, countdown]);

  async function handleKey(k: string) {
    if (locked) return;
    setError('');
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= maxLen) return;
    const next = pin + k;
    setPin(next);

    if (next.length >= 4) {
      setTimeout(() => attempt(next), 100);
    }
  }

  async function attempt(entered: string) {
    const settings = loadSettings();
    const ok = await verifyPin(entered, settings.pinSalt, settings.pinHash);
    if (ok) {
      setAttempts(0);
      unlock();
      return;
    }
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setPin('');
    if (newAttempts >= MAX_ATTEMPTS) {
      setLocked(true);
      setCountdown(Math.ceil(DELAY_MS / 1000));
      setError(`Too many attempts. Please wait…`);
      setShowReset(true);
    } else {
      setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt(s) left.`);
    }
  }

  function doReset() {
    resetAllData();
    window.location.reload();
  }

  const dots = Array.from({ length: maxLen }, (_, i) => (
    <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''} ${error ? 'error' : ''}`} />
  ));

  return (
    <div className="screen-center" style={{ gap: 'var(--space-8)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>🔒</div>
        <h1 className="page-title">recHERsion</h1>
        <p className="page-desc" style={{ marginTop: 'var(--space-2)' }}>
          Enter your PIN to continue
        </p>
      </div>

      <div className="stack stack-5" style={{ width: '100%', alignItems: 'center' }}>
        <div className="pin-row">{dots}</div>

        {error && (
          <p className="form-error text-center">
            {error}
            {locked && countdown > 0 && ` (${countdown}s)`}
          </p>
        )}

        {!locked && <Numpad onKey={handleKey} />}

        {locked && (
          <div className="spinner" style={{ margin: '0 auto' }} />
        )}
      </div>

      {showReset && (
        <div style={{ textAlign: 'center' }}>
          {!resetConfirm ? (
            <button
              id="btn-reset-app"
              className="btn btn-ghost text-sm text-danger"
              onClick={() => setResetConfirm(true)}
            >
              Forgot PIN? Reset app data
            </button>
          ) : (
            <div className="card" style={{ maxWidth: 300, margin: '0 auto' }}>
              <p className="text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                ⚠️ This will erase all your data permanently. Are you sure?
              </p>
              <div className="stack stack-3">
                <button id="btn-confirm-reset" className="btn btn-danger btn-full" onClick={doReset}>
                  Yes, erase everything
                </button>
                <button className="btn btn-secondary btn-full" onClick={() => setResetConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
