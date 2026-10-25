// ============================================================
// SOS screen – distress signal with location + messaging
// ============================================================
import React, { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { useApp } from '../store/AppContext';
import { getCurrentPosition, buildSOSMessage, geoErrorMessage } from '../utils/geo';
import type { GeoFix, GeoError } from '../utils/geo';

type SOSStatus = 'idle' | 'locating' | 'ready' | 'error';

export function SOSScreen() {
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const [status, setStatus] = useState<SOSStatus>('idle');
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<GeoError | null>(null);
  const [copied, setCopied] = useState(false);
  const [contactName, setContactName] = useState(settings.trustedContact?.name ?? '');
  const [contactPhone, setContactPhone] = useState(settings.trustedContact?.phone ?? '');
  const [editingContact, setEditingContact] = useState(!settings.trustedContact);

  async function handleSOS() {
    setStatus('locating');
    setGeoError(null);
    try {
      const position = await getCurrentPosition();
      setFix(position);
      setStatus('ready');
    } catch (e) {
      setGeoError(e as GeoError);
      setFix(null);
      setStatus('error');
    }
  }

  const message = buildSOSMessage(fix, contactName);

  function handleSMS() {
    const phone = contactPhone.replace(/\D/g, '');
    const uri = `sms:${phone}?body=${encodeURIComponent(message)}`;
    window.open(uri, '_self');
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SOS – I need help!', text: message });
      } catch (_) { /* user cancelled */ }
    } else {
      handleCopy();
    }
  }

  function saveContact() {
    if (!contactName.trim() || !contactPhone.trim()) return;
    updateSettings({ ...settings, trustedContact: { name: contactName.trim(), phone: contactPhone.trim() } });
    setEditingContact(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar
        title="SOS"
        subtitle="Sends your location to your trusted contact"
        backTo="home"
      />

      <div className="screen-padded">
        {/* Description */}
        <div className="info-banner info">
          <span>ℹ️</span>
          <span>Tap SOS to get your location. Then choose how to send the alert. The app never contacts anyone without your tap.</span>
        </div>

        {/* Big SOS button */}
        <div className="row-center" style={{ paddingTop: 'var(--space-4)' }}>
          <button
            id="btn-sos-main"
            className="btn btn-sos"
            onClick={handleSOS}
            disabled={status === 'locating'}
            aria-label="Activate SOS"
          >
            {status === 'locating' ? (
              <>
                <div className="spinner" style={{ border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', width: 32, height: 32 }} />
                <span style={{ fontSize: 'var(--text-base)', marginTop: 4 }}>Locating…</span>
              </>
            ) : (
              <>
                <span>SOS</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, opacity: 0.85 }}>Tap to alert</span>
              </>
            )}
          </button>
        </div>

        {/* Error state */}
        {status === 'error' && geoError && (
          <div className="info-banner error">
            <span>⚠️</span>
            <div>
              <strong>Location unavailable</strong>
              <p style={{ marginTop: 4 }}>{geoErrorMessage(geoError)}</p>
              <p style={{ marginTop: 4 }}>You can still send a manual alert without location.</p>
              <button
                className="btn btn-sm btn-secondary"
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => setStatus('ready')}
              >
                Continue without location
              </button>
            </div>
          </div>
        )}

        {/* Ready state – show message and send options */}
        {(status === 'ready') && (
          <div className="stack stack-4">
            {fix && (
              <div className="info-banner success">
                <span>📍</span>
                <span>Location found (±{Math.round(fix.accuracy)}m). Message ready.</span>
              </div>
            )}

            <div className="card" style={{ background: 'var(--warm-50)' }}>
              <p className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Message preview</p>
              <pre style={{
                fontSize: 'var(--text-xs)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.6
              }}>
                {message}
              </pre>
            </div>

            {/* Send buttons */}
            <div className="stack stack-3">
              <button id="btn-send-sms" className="btn btn-primary btn-full btn-lg" onClick={handleSMS}>
                📱 Send SMS
              </button>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button id="btn-copy-msg" className="btn btn-secondary btn-full" onClick={handleCopy}>
                  {copied ? '✓ Copied!' : '📋 Copy message'}
                </button>
                <button id="btn-share-msg" className="btn btn-secondary btn-full" onClick={handleShare}>
                  🔗 Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emergency numbers */}
        <div className="card">
          <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>Emergency contacts</p>
          <div className="emergency-list">
            <div className="emergency-item">
              <div>
                <div className="text-sm font-semibold">🆘 Emergency (India)</div>
                <div className="text-xs text-muted">All emergency services</div>
              </div>
              <a href="tel:112" id="sos-tel-112">Call 112</a>
            </div>
            <div className="emergency-item">
              <div>
                <div className="text-sm font-semibold">👮 Police</div>
              </div>
              <a href="tel:100" id="sos-tel-100">Call 100</a>
            </div>
            <div className="emergency-item">
              <div>
                <div className="text-sm font-semibold">🌸 Women's Helpline</div>
                <div className="text-xs text-muted">National Commission for Women</div>
              </div>
              <a href="tel:1091" id="sos-tel-1091">Call 1091</a>
            </div>
          </div>
        </div>

        {/* Trusted contact */}
        <div className="card">
          <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
            <p className="form-label">Trusted contact</p>
            {!editingContact && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingContact(true)}>
                Edit
              </button>
            )}
          </div>

          {editingContact ? (
            <div className="stack stack-3">
              <div className="form-group">
                <label className="form-label" htmlFor="contact-name">Name</label>
                <input
                  id="contact-name"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Mom"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-phone">Phone number</label>
                <input
                  id="contact-phone"
                  className="form-input"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                />
              </div>
              <button
                id="btn-save-contact"
                className="btn btn-primary btn-full"
                onClick={saveContact}
                disabled={!contactName.trim() || !contactPhone.trim()}
              >
                Save contact
              </button>
            </div>
          ) : (
            <div className="stack stack-2">
              <div className="text-sm font-semibold">{settings.trustedContact?.name}</div>
              <div className="text-sm text-muted">{settings.trustedContact?.phone}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
