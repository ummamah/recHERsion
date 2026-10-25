// ============================================================
// Settings screen
// ============================================================
import React, { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { useApp } from '../store/AppContext';
import { resetAllData } from '../utils/storage';
import { generateSalt, hashPin } from '../utils/crypto';

export function SettingsScreen() {
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const [showChangePIN, setShowChangePIN] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [showReset, setShowReset] = useState(false);

  async function changePIN() {
    if (newPin.length < 4) { setPinMsg('PIN must be at least 4 digits.'); return; }
    if (newPin !== confirmPin) { setPinMsg('PINs do not match.'); return; }
    const salt = await generateSalt();
    const hash = await hashPin(newPin, salt);
    updateSettings({ ...settings, pinHash: hash, pinSalt: salt });
    setPinMsg('PIN changed successfully!');
    setNewPin(''); setConfirmPin('');
    setTimeout(() => setShowChangePIN(false), 1000);
  }

  function doReset() {
    resetAllData();
    window.location.reload();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar title="Settings" backTo="home" />
      <div className="screen-padded">
        {/* Notifications */}
        <div className="card">
          <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>Notifications</p>
          <div className="toggle-row" style={{ border: 'none', padding: 0 }}>
            <div className="toggle-label-group">
              <span className="toggle-label">Browser notifications</span>
              <span className="toggle-desc">Journey check-in reminders</span>
            </div>
            <label className="toggle-switch">
              <input
                id="notif-toggle"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={async e => {
                  if (e.target.checked) {
                    const perm = await Notification.requestPermission();
                    updateSettings({ ...settings, notificationsEnabled: perm === 'granted' });
                  } else {
                    updateSettings({ ...settings, notificationsEnabled: false });
                  }
                }}
              />
              <span className="toggle-track" />
            </label>
          </div>
        </div>

        {/* Change PIN */}
        <div className="card">
          <div className="row-between">
            <p className="form-label">Security PIN</p>
            <button
              id="btn-change-pin"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowChangePIN(s => !s)}
            >
              {showChangePIN ? 'Cancel' : 'Change'}
            </button>
          </div>
          {showChangePIN && (
            <div className="stack stack-3" style={{ marginTop: 'var(--space-3)' }}>
              <input
                id="new-pin"
                className="form-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="New PIN (4–6 digits)"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              />
              <input
                id="confirm-pin"
                className="form-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Confirm new PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              />
              {pinMsg && <p className={`text-sm ${pinMsg.includes('success') ? 'text-success' : 'text-danger'}`}>{pinMsg}</p>}
              <button id="btn-save-pin" className="btn btn-primary btn-full" onClick={changePIN}>
                Save new PIN
              </button>
            </div>
          )}
        </div>

        {/* About */}
        <div className="card">
          <p className="form-label" style={{ marginBottom: 'var(--space-2)' }}>About recHERsion</p>
          <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
            A free, open-source women's safety companion. All data is stored locally on your device.
            No account, no tracking, no backend.
          </p>
          <p className="text-sm text-muted" style={{ marginTop: 'var(--space-2)' }}>
            Version 1.0.0 · Built for 24-hour hackathon
          </p>
          <div className="info-banner warn" style={{ marginTop: 'var(--space-3)' }}>
            <span>⚠️</span>
            <span>This app does not guarantee safety. Always call emergency services (112) in an emergency.</span>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ border: '1.5px solid var(--color-high)' }}>
          <p className="form-label" style={{ color: 'var(--color-high)', marginBottom: 'var(--space-3)' }}>
            Danger zone
          </p>
          {!showReset ? (
            <button
              id="btn-show-reset"
              className="btn btn-danger btn-full"
              onClick={() => setShowReset(true)}
            >
              Reset all app data
            </button>
          ) : (
            <div className="stack stack-3">
              <p className="text-sm">
                This will erase your PIN, trusted contact, and all journey data. This cannot be undone.
              </p>
              <button id="btn-confirm-reset-settings" className="btn btn-danger btn-full" onClick={doReset}>
                Yes, erase everything
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => setShowReset(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
