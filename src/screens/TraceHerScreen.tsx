// ============================================================
// TraceHer screen – message pattern detection & evaluation
// ============================================================
import React, { useState, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import {
  parseMessages, classifyMethodA, classifyMethodB,
  groupBySender, evaluateMethod,
} from '../utils/ruleEngine';
import { loadCorrections, saveCorrection } from '../utils/storage';
import type { ScoredMessage, SenderGroup, MessageLabel } from '../types';

type Tab = 'analyze' | 'timeline' | 'evaluate';

// ── Score badge ─────────────────────────────────────────────
function ScoreBadge({ score, level }: { score: number; level: MessageLabel }) {
  const cls = level === 'safe' ? 'badge-low' : level === 'suspicious' ? 'badge-medium' : 'badge-high';
  return (
    <span className={`badge ${cls}`}>{level} ({Math.round(score * 100)}%)</span>
  );
}

// ── Single message card ─────────────────────────────────────
function MessageCard({
  msg, correction, onCorrect,
}: {
  msg: ScoredMessage;
  correction?: string;
  onCorrect: (id: string, c: string) => void;
}) {
  const levelClass = msg.level === 'safe' ? 'score-low' : msg.level === 'suspicious' ? 'score-medium' : 'score-high';
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`message-item ${levelClass}`}>
      <div className="row-between" style={{ marginBottom: 'var(--space-1)' }}>
        <span className="text-xs text-muted">{msg.sender} · {msg.timestamp}</span>
        <ScoreBadge score={msg.score} level={msg.level} />
      </div>
      <p className="message-text">{msg.text}</p>

      {msg.matchedRules.length > 0 && (
        <>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 0', fontSize: 'var(--text-xs)' }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? '▲ Hide rules' : `▼ ${msg.matchedRules.length} rule(s) matched`}
          </button>
          {expanded && (
            <div className="message-meta" style={{ marginTop: 'var(--space-2)' }}>
              {msg.matchedRules.map((r, i) => (
                <span key={i} className="rule-tag">{r.reason}</span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Correction buttons */}
      <div className="correction-row">
        {(['safe', 'suspicious', 'threat', 'unsure'] as const).map(c => (
          <button
            key={c}
            className={`correction-btn ${c} ${correction === c ? 'active' : ''}`}
            onClick={() => onCorrect(msg.id, c)}
          >
            {c === 'unsure' ? '?' : c}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Timeline tab ────────────────────────────────────────────
function TimelineView({ groups }: { groups: SenderGroup[] }) {
  const [selected, setSelected] = useState(0);
  if (groups.length === 0) return <p className="text-sm text-muted">No groups yet.</p>;
  const g = groups[selected];
  return (
    <div className="stack stack-4">
      <div className="form-group">
        <label className="form-label" htmlFor="sender-select">Sender / Group</label>
        <select id="sender-select" className="form-input"
          value={selected} onChange={e => setSelected(Number(e.target.value))}>
          {groups.map((gr, i) => (
            <option key={i} value={i}>
              {gr.sender} — group score {Math.round(gr.groupScore * 100)}%
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ borderLeft: `4px solid ${g.groupScore > 0.6 ? 'var(--color-high)' : g.groupScore > 0.3 ? 'var(--color-medium)' : 'var(--color-low)'}` }}>
        <div className="row-between">
          <div>
            <p className="font-semibold">{g.sender}</p>
            <p className="text-xs text-muted">{g.messages.length} messages</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="text-xs text-muted">Group score</p>
            <p className="font-bold" style={{ fontSize: 'var(--text-xl)', color: g.groupScore > 0.6 ? 'var(--color-high)' : g.groupScore > 0.3 ? 'var(--color-medium)' : 'var(--color-low)' }}>
              {Math.round(g.groupScore * 100)}%
            </p>
          </div>
        </div>
        {g.patternBonus > 0 && (
          <div className="info-banner warn" style={{ marginTop: 'var(--space-3)' }}>
            <span>⚠️</span>
            <span>Pattern bonus +{Math.round(g.patternBonus * 100)}% — escalation or repetition detected.</span>
          </div>
        )}
      </div>

      {/* Mini escalation chart */}
      <div className="card">
        <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>Escalation over time</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
          {g.escalation.map((s, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${Math.max(4, s * 80)}px`,
              background: s > 0.6 ? 'var(--color-high)' : s > 0.3 ? 'var(--color-medium)' : 'var(--color-low)',
              borderRadius: 3,
              minWidth: 8,
              transition: 'height 0.3s ease',
            }} title={`Msg ${i + 1}: ${Math.round(s * 100)}%`} />
          ))}
        </div>
        <p className="text-xs text-muted" style={{ marginTop: 'var(--space-2)' }}>
          Each bar = one message. Taller = higher score.
        </p>
      </div>

      <div className="timeline">
        {g.messages.map((m, i) => (
          <div key={i} className={`timeline-item ${m.level}`}>
            <p className="text-xs text-muted">{m.timestamp}</p>
            <p className="text-sm">{m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}</p>
            <ScoreBadge score={m.score} level={m.level} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Evaluate tab ────────────────────────────────────────────
function EvaluateView({
  methodAMessages, methodBMessages,
}: {
  methodAMessages: ScoredMessage[];
  methodBMessages: ScoredMessage[];
}) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    a: ReturnType<typeof evaluateMethod>;
    b: ReturnType<typeof evaluateMethod>;
    corrections: number;
  } | null>(null);

  async function runEval() {
    setRunning(true);
    try {
      const resp = await fetch('/data/synthetic-messages.csv');
      const text = await resp.text();
      const lines = text.trim().split('\n');
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const idIdx    = header.indexOf('id');
      const labelIdx = header.indexOf('label');

      const labels = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        return { id: cols[idIdx], label: cols[labelIdx] as MessageLabel };
      }).filter(l => l.id && l.label);

      const corrections = Object.keys(loadCorrections()).length;

      const evalA = evaluateMethod(methodAMessages, labels);
      const evalB = evaluateMethod(methodBMessages, labels);
      setResults({ a: evalA, b: evalB, corrections });
    } catch {
      alert('Could not load synthetic-messages.csv. Make sure it is in /public/data/.');
    } finally {
      setRunning(false);
    }
  }

  function fmt(n: number) { return (n * 100).toFixed(1) + '%'; }

  return (
    <div className="stack stack-4">
      <div className="info-banner info">
        <span>ℹ️</span>
        <span>
          Compares two classification methods on the synthetic dataset (300+ labelled messages).
          Method A: each message alone. Method B: group-aware with pattern bonus.
        </span>
      </div>

      <button
        id="btn-run-eval"
        className="btn btn-primary btn-full btn-lg"
        onClick={runEval}
        disabled={running || methodAMessages.length === 0}
      >
        {running ? '⏳ Running…' : methodAMessages.length === 0 ? 'Analyse messages first' : '▶ Run evaluation'}
      </button>

      {results && (
        <>
          <div className="card">
            <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>Results</p>
            <table className="eval-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1</th>
                  <th>TP / FP / FN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>A – Single</strong></td>
                  <td>{fmt(results.a.precision)}</td>
                  <td>{fmt(results.a.recall)}</td>
                  <td id="eval-f1-a"><strong>{fmt(results.a.f1)}</strong></td>
                  <td>{results.a.tp}/{results.a.fp}/{results.a.fn}</td>
                </tr>
                <tr>
                  <td><strong>B – Multi</strong></td>
                  <td>{fmt(results.b.precision)}</td>
                  <td>{fmt(results.b.recall)}</td>
                  <td id="eval-f1-b"><strong>{fmt(results.b.f1)}</strong></td>
                  <td>{results.b.tp}/{results.b.fp}/{results.b.fn}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <p className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Interpretation</p>
            <p className="text-sm" style={{ lineHeight: 1.6 }}>
              <strong>Method A</strong> (single-message) is better for catching isolated, high-severity
              messages like explicit threats or OTP requests — each message is judged on its own merit.
            </p>
            <p className="text-sm" style={{ lineHeight: 1.6, marginTop: 'var(--space-2)' }}>
              <strong>Method B</strong> (multi-incident) improves recall for escalation sequences — repeated
              low-score messages that together form a harassment pattern. It adds a pattern bonus that
              lifts borderline messages in a sender group.
            </p>
            <p className="text-sm" style={{ lineHeight: 1.6, marginTop: 'var(--space-2)' }}>
              User corrections stored: <strong>{results.corrections}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main TraceHer screen ────────────────────────────────────
export function TraceHerScreen() {
  const [tab, setTab] = useState<Tab>('analyze');
  const [rawText, setRawText] = useState('');
  const [methodAMsgs, setMethodAMsgs] = useState<ScoredMessage[]>([]);
  const [methodBMsgs, setMethodBMsgs] = useState<ScoredMessage[]>([]);
  const [groups, setGroups] = useState<SenderGroup[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>(loadCorrections());
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setRawText(text);
      processMessages(text);
    };
    reader.readAsText(file);
  }

  function processMessages(text: string) {
    const parsed = parseMessages(text);
    const a = classifyMethodA(parsed);
    const b = classifyMethodB(parsed);
    setMethodAMsgs(a);
    setMethodBMsgs(b);
    setGroups(groupBySender(b));
    setTab('analyze');
  }

  function handleCorrect(id: string, c: string) {
    saveCorrection(id, c);
    setCorrections(loadCorrections());
  }

  const DEMO_MESSAGES = `sender,timestamp,text,url,ip
Alice,2026-10-01T09:00,Hi how are you,,
Alice,2026-10-01T09:05,You'll regret not replying,,
Bob,2026-10-01T10:00,Your account will be blocked. Share your OTP immediately.,bit.ly/xz9,
Bob,2026-10-01T10:01,This is your last chance. Send OTP now or else.,bit.ly/xz9,
Charlie,2026-10-01T11:00,Hey do you want to grab coffee?,, 
Dave,2026-10-01T12:00,Calling from bank RBI. Account suspended. Verify card details now.,,192.168.1.5
Dave,2026-10-01T12:03,This is final warning. Pay immediately or we take action.,,
Dave,2026-10-01T12:05,If you don't respond I will find you.,,`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar
        title="TraceHer"
        subtitle="Detect patterns in suspicious messages"
        backTo="home"
      />

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}>
        {(['analyze', 'timeline', 'evaluate'] as Tab[]).map(t => (
          <button
            key={t}
            id={`tab-${t}`}
            className="btn btn-ghost"
            style={{
              flex: 1,
              borderRadius: 0,
              borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontWeight: tab === t ? 600 : 400,
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-3) var(--space-2)',
              minHeight: 44,
            }}
            onClick={() => setTab(t)}
          >
            {t === 'analyze' ? '🔍 Analyse' : t === 'timeline' ? '📈 Timeline' : '📊 Evaluate'}
          </button>
        ))}
      </div>

      <div className="screen-padded">
        {tab === 'analyze' && (
          <div className="stack stack-4">
            {/* Input */}
            <div className="card">
              <p className="form-label" style={{ marginBottom: 'var(--space-3)' }}>
                Paste messages or upload a file
              </p>
              <textarea
                id="msg-paste-area"
                className="form-input"
                style={{ minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Paste CSV (sender,timestamp,text,url,ip) or plain text messages, one per line…"
              />
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <button
                  id="btn-analyze"
                  className="btn btn-primary btn-full"
                  onClick={() => processMessages(rawText)}
                  disabled={!rawText.trim()}
                >
                  Analyse
                </button>
                <button
                  id="btn-upload-file"
                  className="btn btn-secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload file
                </button>
                <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }}
                  onChange={handleFileUpload} />
              </div>
              <button
                id="btn-load-demo"
                className="btn btn-ghost btn-full btn-sm"
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => { setRawText(DEMO_MESSAGES); processMessages(DEMO_MESSAGES); }}
              >
                Load demo messages
              </button>
            </div>

            {/* Summary */}
            {methodAMsgs.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <div>
                    <p className="text-xs text-muted">Total</p>
                    <p className="font-bold text-lg">{methodAMsgs.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Safe</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--color-safe)' }}>
                      {methodAMsgs.filter(m => m.level === 'safe').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Suspicious</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--color-medium)' }}>
                      {methodAMsgs.filter(m => m.level === 'suspicious').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Threat</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--color-high)' }}>
                      {methodAMsgs.filter(m => m.level === 'threat').length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message list */}
            {methodAMsgs.map(msg => (
              <MessageCard
                key={msg.id}
                msg={msg}
                correction={corrections[msg.id]}
                onCorrect={handleCorrect}
              />
            ))}
          </div>
        )}

        {tab === 'timeline' && (
          <TimelineView groups={groups} />
        )}

        {tab === 'evaluate' && (
          <EvaluateView methodAMessages={methodAMsgs} methodBMessages={methodBMsgs} />
        )}
      </div>
    </div>
  );
}
