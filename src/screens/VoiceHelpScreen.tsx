// ============================================================
// VoiceHelp screen – SpeechRecognition trigger
// ============================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { useApp } from '../store/AppContext';
import { getCurrentPosition, buildSOSMessage } from '../utils/geo';

// Declare browser SpeechRecognition types
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognitionInstance;
    };
  }
}

const getSpeechRecognition = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

type VoiceStatus = 'off' | 'listening' | 'triggered' | 'countdown' | 'sent';

export function VoiceHelpScreen() {
  const { state, updateSettings, navigate } = useApp();
  const { settings } = state;

  const [voiceOn, setVoiceOn] = useState(settings.voiceHelpEnabled);
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [lastTranscript, setLastTranscript] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [phraseInput, setPhraseInput] = useState(settings.voiceTriggerPhrases.join(', '));
  const [unsupported, setUnsupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const SpeechRecognitionAPI = getSpeechRecognition();

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus('off');
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) { setUnsupported(true); return; }

    const r = new SpeechRecognitionAPI();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-IN';

    r.onresult = (e: SpeechRecognitionEvent) => {
      const phrases = settings.voiceTriggerPhrases.map(p => p.toLowerCase().trim());
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript.toLowerCase();
        setLastTranscript(transcript);
        for (const phrase of phrases) {
          if (transcript.includes(phrase)) {
            setStatus('triggered');
            r.stop();
            startCountdown();
            return;
          }
        }
      }
    };

    r.onerror = () => { setStatus('off'); };

    r.onend = () => {
      // Restart if still supposed to be on
      if (voiceOn && status === 'listening') {
        try { r.start(); } catch (_) {}
      }
    };

    r.start();
    recognitionRef.current = r;
    setStatus('listening');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, settings.voiceTriggerPhrases]);

  function startCountdown() {
    cancelledRef.current = false;
    setCountdown(5);
    setStatus('countdown');

    let c = 5;
    countdownRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownRef.current!);
        if (!cancelledRef.current) triggerSOS();
      }
    }, 1000);
  }

  function cancelCountdown() {
    cancelledRef.current = true;
    clearInterval(countdownRef.current!);
    setStatus('listening');
    startListening();
  }

  async function triggerSOS() {
    setStatus('sent');
    try {
      const fix = await getCurrentPosition(10000);
      const msg = buildSOSMessage(fix, settings.trustedContact?.name ?? '');
      const phone = settings.trustedContact?.phone.replace(/\D/g, '') ?? '';
      if (phone) window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, '_self');
    } catch {
      // Navigate to SOS screen so user can send manually
      navigate('sos');
    }
  }

  // Toggle voice on/off
  useEffect(() => {
    if (voiceOn && status === 'off') {
      startListening();
    } else if (!voiceOn) {
      stopListening();
    }
    updateSettings({ ...settings, voiceHelpEnabled: voiceOn });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);

  useEffect(() => {
    return () => { stopListening(); clearInterval(countdownRef.current!); };
  }, [stopListening]);

  function savePhrases() {
    const phrases = phraseInput.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    updateSettings({ ...settings, voiceTriggerPhrases: phrases });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar
        title="Voice Help"
        subtitle="Trigger an SOS with a keyword"
        backTo="home"
      />

      <div className="screen-padded">
        {unsupported ? (
          <div className="info-banner warn">
            <span>⚠️</span>
            <div>
              <strong>Speech recognition not supported</strong>
              <p style={{ marginTop: 4 }}>
                Your browser does not support the Web Speech API. Try Chrome on Android or Edge.
                Firefox and iOS Safari are not supported.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="info-banner info">
              <span>ℹ️</span>
              <span>
                When Voice Help is on, the app listens for your trigger phrase. If heard, a 5-second
                countdown starts before sending your SOS — you can cancel it any time.
              </span>
            </div>

            {/* Main toggle */}
            <div className="toggle-row">
              <div className="toggle-label-group">
                <span className="toggle-label">Voice Help</span>
                <span className="toggle-desc">
                  {voiceOn ? (status === 'listening' ? '🔴 Listening…' : '⏳ Starting…') : 'Off'}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  id="voice-toggle"
                  type="checkbox"
                  checked={voiceOn}
                  onChange={e => setVoiceOn(e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>

            {/* Live indicator */}
            {voiceOn && status === 'listening' && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'var(--teal-100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                  animation: 'sosPulse 2s infinite',
                  fontSize: 28,
                }}>
                  🎙️
                </div>
                <p className="text-sm text-muted">Listening for trigger phrase…</p>
                {lastTranscript && (
                  <p className="text-xs text-muted" style={{ marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                    Heard: "{lastTranscript}"
                  </p>
                )}
              </div>
            )}

            {/* Countdown overlay */}
            {status === 'countdown' && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', background: '#fff8f8', border: '2px solid var(--color-high)' }}>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-high)', marginBottom: 'var(--space-4)' }}>
                  🆘 Trigger phrase detected!
                </p>
                <div style={{
                  width: 96, height: 96, borderRadius: '50%',
                  background: 'var(--color-high)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                  color: 'white', fontSize: 'var(--text-3xl)', fontWeight: 700
                }}>
                  {countdown}
                </div>
                <p className="text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                  Sending SOS in {countdown} second{countdown !== 1 ? 's' : ''}…
                </p>
                <button
                  id="btn-cancel-countdown"
                  className="btn btn-primary btn-full btn-lg"
                  onClick={cancelCountdown}
                >
                  Cancel — I'm safe
                </button>
              </div>
            )}

            {status === 'sent' && (
              <div className="info-banner success">
                <span>✅</span>
                <span>SOS triggered! Opening your SMS app…</span>
              </div>
            )}

            {/* Trigger phrase configuration */}
            <div className="card">
              <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>
                Trigger phrases
              </p>
              <div className="form-group">
                <input
                  id="voice-phrases"
                  className="form-input"
                  value={phraseInput}
                  onChange={e => setPhraseInput(e.target.value)}
                  placeholder="e.g. help me, save me"
                />
                <p className="form-hint">Separate multiple phrases with commas</p>
              </div>
              <button
                id="btn-save-phrases"
                className="btn btn-secondary btn-full"
                style={{ marginTop: 'var(--space-3)' }}
                onClick={savePhrases}
              >
                Save phrases
              </button>
            </div>

            <div className="info-banner warn">
              <span>⚠️</span>
              <span>
                <strong>Important:</strong> Voice recognition stops when the screen is off or the app is
                in the background. Keep the screen on for this to work reliably.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
