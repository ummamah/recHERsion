// ============================================================
// Global app state – simple React context, no extra deps
// ============================================================
import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import {
  loadSettings, saveSettings, isFirstLaunch,
  loadJourney, saveJourney, clearJourney,
} from '../utils/storage';
import type { AppSettings, JourneyState } from '../types';

export type Screen =
  | 'setup_pin'
  | 'lock'
  | 'home'
  | 'sos'
  | 'voice_help'
  | 'risk'
  | 'journey'
  | 'tracehr'
  | 'settings';

interface AppState {
  screen: Screen;
  settings: AppSettings;
  journey: JourneyState | null;
  locked: boolean;
  firstLaunch: boolean;
}

type Action =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'UNLOCK' }
  | { type: 'LOCK' }
  | { type: 'SET_SETTINGS'; settings: AppSettings }
  | { type: 'SET_JOURNEY'; journey: JourneyState | null }
  | { type: 'PIN_SET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, screen: action.screen };
    case 'UNLOCK':
      return { ...state, locked: false, screen: 'home' };
    case 'LOCK':
      return { ...state, locked: true, screen: 'lock' };
    case 'SET_SETTINGS':
      saveSettings(action.settings);
      return { ...state, settings: action.settings };
    case 'SET_JOURNEY':
      if (action.journey) saveJourney(action.journey);
      else clearJourney();
      return { ...state, journey: action.journey };
    case 'PIN_SET':
      return { ...state, firstLaunch: false, locked: false, screen: 'home' };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  navigate: (s: Screen) => void;
  unlock: () => void;
  lock: () => void;
  updateSettings: (s: AppSettings) => void;
  updateJourney: (j: JourneyState | null) => void;
  pinSet: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const first = isFirstLaunch();
  const [state, dispatch] = useReducer(reducer, {
    screen: first ? 'setup_pin' : 'lock',
    settings: loadSettings(),
    journey: loadJourney(),
    locked: !first,
    firstLaunch: first,
  });

  // Inactivity timer (2 minutes)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetInactivity() {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (!state.locked && state.screen !== 'lock' && state.screen !== 'setup_pin') {
      inactivityTimer.current = setTimeout(() => {
        dispatch({ type: 'LOCK' });
      }, 2 * 60 * 1000);
    }
  }

  useEffect(() => {
    const events = ['touchstart', 'touchmove', 'click', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetInactivity, { passive: true }));
    resetInactivity();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.locked, state.screen]);

  const ctx: AppContextValue = {
    state,
    navigate: (s) => dispatch({ type: 'NAVIGATE', screen: s }),
    unlock:   () => dispatch({ type: 'UNLOCK' }),
    lock:     () => dispatch({ type: 'LOCK' }),
    updateSettings: (s) => dispatch({ type: 'SET_SETTINGS', settings: s }),
    updateJourney:  (j) => dispatch({ type: 'SET_JOURNEY', journey: j }),
    pinSet: () => dispatch({ type: 'PIN_SET' }),
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
