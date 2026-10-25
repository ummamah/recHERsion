// ============================================================
// SetupPin screen – first-launch PIN creation
// ============================================================
import React, { useState } from 'react';
import { Numpad } from '../components/Numpad';
import { generateSalt, hashPin } from '../utils/crypto';
import { loadSettings, saveSettings } from '../utils/storage';
import { useApp } from '../store/AppContext';

type Step = 'enter' | 'confirm';

export function SetupPin() {
  const { pinSet } = useApp();
  const [step, setStep] = useState<Step>('enter');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState('');
  const maxLen = 6;

  const current = step === 'enter' ? first : second;
  const setCurrent = step === 'enter' ? setFirst : setSecond;

  function handleKey(k: string) {
    setError('');
    if (k === '⌫') {
      setCurrent(p => p.slice(0, -1));
      return;
    }
    if (current.length >= maxLen) return;
    const next = current + k;
    setCurrent(next);

    if (next.length >= 4) {
      if (step === 'enter') {
        // Move to confirm after a tiny delay (UX)
        setTimeout(() => setStep('confirm'), 200);
      } else {
        // Confirm step
        setTimeout(() => handleConfirm(next), 200);
      }
    }
  }

  async function handleConfirm(confirmPin: string) {
    if (confirmPin !== first) {
      setError('PINs do not match. Please try again.');
      setStep('enter');
      setFirst('');
      setSecond('');
      return;
    }
    const salt = await generateSalt();
    const hash = await hashPin(first, salt);
    const settings = loadSettings();
    saveSettings({ ...settings, pinHash: hash, pinSalt: salt });
    pinSet();
  }

  const displayPin = current;
  const dots = Array.from({ length: maxLen }, (_, i) => (
    <div
      key={i}
      className={`pin-dot ${i < displayPin.length ? 'filled' : ''} ${error ? 'error' : ''}`}
    />
  ));

  return (
    <div className="screen-center" style={{ gap: 'var(--space-8)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }}>🔐</div>
        <h1 className="page-title">Set your PIN</h1>
        <p className="page-desc" style={{ marginTop: 'var(--space-2)' }}>
          {step === 'enter'
            ? 'Choose a 4–6 digit PIN to protect your app.'
            : 'Enter the same PIN again to confirm.'}
        </p>
      </div>

      <div className="stack stack-5" style={{ width: '100%', alignItems: 'center' }}>
        <div className="pin-row">{dots}</div>
        {error && <p className="form-error text-center">{error}</p>}
        <Numpad onKey={handleKey} />
      </div>
    </div>
  );
}
