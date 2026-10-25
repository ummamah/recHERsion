// ============================================================
// TopBar component – shared navigation bar
// ============================================================
import React from 'react';
import { useApp } from '../store/AppContext';
import type { Screen } from '../store/AppContext';

interface TopBarProps {
  title: string;
  subtitle?: string;
  backTo?: Screen;
  rightElement?: React.ReactNode;
}

export function TopBar({ title, subtitle, backTo, rightElement }: TopBarProps) {
  const { navigate } = useApp();
  return (
    <div className="top-bar">
      {backTo && (
        <button
          className="top-bar__back"
          onClick={() => navigate(backTo)}
          aria-label="Go back"
          id="btn-back"
        >
          ←
        </button>
      )}
      <div style={{ flex: 1 }}>
        <div className="top-bar__title">{title}</div>
        {subtitle && <div className="top-bar__subtitle">{subtitle}</div>}
      </div>
      {rightElement}
    </div>
  );
}
