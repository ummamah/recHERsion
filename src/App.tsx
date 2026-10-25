// ============================================================
// App.tsx – root router
// ============================================================
import React from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { SetupPin }       from './screens/SetupPin';
import { LockScreen }     from './screens/LockScreen';
import { HomeScreen }     from './screens/HomeScreen';
import { SOSScreen }      from './screens/SOSScreen';
import { VoiceHelpScreen } from './screens/VoiceHelpScreen';
import { RiskScreen }     from './screens/RiskScreen';
import { JourneyScreen }  from './screens/JourneyScreen';
import { TraceHerScreen } from './screens/TraceHerScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function Router() {
  const { state } = useApp();
  switch (state.screen) {
    case 'setup_pin':  return <SetupPin />;
    case 'lock':       return <LockScreen />;
    case 'home':       return <HomeScreen />;
    case 'sos':        return <SOSScreen />;
    case 'voice_help': return <VoiceHelpScreen />;
    case 'risk':       return <RiskScreen />;
    case 'journey':    return <JourneyScreen />;
    case 'tracehr':    return <TraceHerScreen />;
    case 'settings':   return <SettingsScreen />;
    default:           return <HomeScreen />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Router />
      </div>
    </AppProvider>
  );
}
