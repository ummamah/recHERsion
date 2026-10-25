// ============================================================
// Numpad component – shared by SetupPin and LockScreen
// ============================================================
import React from 'react';

interface NumpadProps {
  onKey: (key: string) => void;
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export function Numpad({ onKey }: NumpadProps) {
  return (
    <div className="numpad">
      {KEYS.map((k, i) => (
        <button
          key={i}
          className={`numpad-key ${k === '' ? 'empty' : ''} ${k === '⌫' ? 'delete' : ''}`}
          onClick={() => k && onKey(k)}
          aria-label={k === '⌫' ? 'Delete' : k === '' ? '' : k}
          id={k === '⌫' ? 'numpad-delete' : k === '' ? undefined : `numpad-${k}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
