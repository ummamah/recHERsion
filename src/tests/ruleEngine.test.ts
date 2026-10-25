// ============================================================
// Tests for the rule engine (TraceHer)
// Run: npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  scoreMessage, groupBySender, classifyMethodA, classifyMethodB,
  parseMessages, evaluateMethod,
} from '../utils/ruleEngine';
import type { ParsedMessage, ScoredMessage } from '../types';

// ── Helpers ──────────────────────────────────────────────────

function makeMsg(text: string, sender = 'test', id?: string, url?: string): ParsedMessage {
  return {
    id: id ?? text.slice(0, 8),
    sender,
    timestamp: '2026-10-01T10:00:00',
    text,
    url,
  };
}

// ── scoreMessage ─────────────────────────────────────────────

describe('scoreMessage', () => {
  it('classifies a safe greeting as safe', () => {
    const result = scoreMessage(makeMsg('Hey, how are you?'));
    expect(result.level).toBe('safe');
    expect(result.score).toBe(0);
  });

  it('flags an explicit threat', () => {
    const result = scoreMessage(makeMsg("I will hurt you if you don't reply."));
    expect(result.level).toBe('threat');
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('flags OTP request', () => {
    const result = scoreMessage(makeMsg("Please share your OTP to verify your account."));
    expect(result.level).not.toBe('safe');
    expect(result.matchedRules.some(r => r.ruleId === 'sensitive_otp')).toBe(true);
  });

  it('flags coercion "or else"', () => {
    const result = scoreMessage(makeMsg("Send me the files or else you will regret it."));
    expect(result.level).not.toBe('safe');
    expect(result.matchedRules.length).toBeGreaterThan(0);
  });

  it('flags shortened URL', () => {
    const result = scoreMessage(makeMsg("Click this link bit.ly/xz9abc to claim your prize."));
    expect(result.matchedRules.some(r => r.ruleId === 'url_shortened')).toBe(true);
  });

  it('flags IP-address URL', () => {
    const result = scoreMessage(makeMsg('Visit http://192.168.1.5/login for your account'));
    expect(result.matchedRules.some(r => r.ruleId === 'url_ip')).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('flags bank impersonation', () => {
    const result = scoreMessage(makeMsg("Calling from bank RBI. Account suspended. Share account number."));
    expect(result.matchedRules.some(r => r.ruleId.startsWith('impersonation'))).toBe(true);
  });

  it('scores multiple rules higher than single rule', () => {
    const single = scoreMessage(makeMsg("You'll regret this."));
    const multiple = scoreMessage(makeMsg("You'll regret this. Share your OTP now or else. I will hurt you."));
    expect(multiple.score).toBeGreaterThan(single.score);
  });

  it('score is always between 0 and 1', () => {
    const worseCase = scoreMessage(makeMsg(
      "I will hurt you. Share your OTP now or else. Your account is suspended. bit.ly/abc. You'll regret this."
    ));
    expect(worseCase.score).toBeGreaterThanOrEqual(0);
    expect(worseCase.score).toBeLessThanOrEqual(1);
  });

  it('includes matched rule reason text', () => {
    const result = scoreMessage(makeMsg("Share your OTP immediately."));
    const otpRule = result.matchedRules.find(r => r.ruleId === 'sensitive_otp');
    expect(otpRule?.reason).toContain('otp');
  });
});

// ── groupBySender ─────────────────────────────────────────────

describe('groupBySender', () => {
  it('groups messages by sender', () => {
    const msgs: ScoredMessage[] = [
      { ...makeMsg('Hello', 'Alice', 'm1'), score: 0, level: 'safe', matchedRules: [] },
      { ...makeMsg('Hi',    'Bob',   'm2'), score: 0, level: 'safe', matchedRules: [] },
      { ...makeMsg('Hey',   'Alice', 'm3'), score: 0, level: 'safe', matchedRules: [] },
    ];
    const groups = groupBySender(msgs);
    const alice = groups.find(g => g.sender === 'alice');
    expect(alice?.messages.length).toBe(2);
  });

  it('applies pattern bonus for many messages in 24h', () => {
    const baseTime = new Date('2026-10-01T08:00:00').getTime();
    const msgs: ScoredMessage[] = Array.from({ length: 10 }, (_, i) => ({
      ...makeMsg(`Threatening message ${i}`, 'Harasser', `m${i}`),
      timestamp: new Date(baseTime + i * 20 * 60000).toISOString(),
      score: 0.4,
      level: 'suspicious' as const,
      matchedRules: [],
    }));
    const groups = groupBySender(msgs);
    const g = groups[0];
    expect(g.patternBonus).toBeGreaterThan(0);
    expect(g.groupScore).toBeGreaterThan(0.4);
  });

  it('applies escalation bonus when scores increase over time', () => {
    const baseTime = new Date('2026-10-01T08:00:00').getTime();
    const msgs: ScoredMessage[] = [0.1, 0.2, 0.4, 0.6, 0.8].map((score, i) => ({
      ...makeMsg(`msg ${i}`, 'Escalator', `esc${i}`),
      timestamp: new Date(baseTime + i * 30 * 60000).toISOString(),
      score,
      level: (score < 0.25 ? 'safe' : score < 0.6 ? 'suspicious' : 'threat') as ScoredMessage['level'],
      matchedRules: [],
    }));
    const groups = groupBySender(msgs);
    expect(groups[0].patternBonus).toBeGreaterThan(0);
  });
});

// ── classifyMethodA vs classifyMethodB ───────────────────────

describe('classifyMethodA vs classifyMethodB', () => {
  it('returns same count as input', () => {
    const msgs = [
      makeMsg('Hello', 'Alice'),
      makeMsg("I will hurt you.", 'Bob'),
    ];
    const a = classifyMethodA(msgs);
    const b = classifyMethodB(msgs);
    expect(a.length).toBe(2);
    expect(b.length).toBe(2);
  });

  it('method B boosts scores in escalation group', () => {
    const baseTime = new Date('2026-10-01T08:00:00').getTime();
    const msgs: ParsedMessage[] = Array.from({ length: 8 }, (_, i) => ({
      ...makeMsg(`Borderline message number ${i}. You should respond or else.`, 'Sender', `brd${i}`),
      timestamp: new Date(baseTime + i * 15 * 60000).toISOString(),
    }));
    const a = classifyMethodA(msgs);
    const b = classifyMethodB(msgs);
    const avgA = a.reduce((s, m) => s + m.score, 0) / a.length;
    const avgB = b.reduce((s, m) => s + m.score, 0) / b.length;
    // Method B should have equal or higher average score due to group bonus
    expect(avgB).toBeGreaterThanOrEqual(avgA);
  });
});

// ── parseMessages ─────────────────────────────────────────────

describe('parseMessages', () => {
  it('parses CSV with header', () => {
    const csv = `sender,timestamp,text\nAlice,2026-10-01,Hello\nBob,2026-10-01,World`;
    const msgs = parseMessages(csv);
    expect(msgs.length).toBe(2);
    expect(msgs[0].sender).toBe('Alice');
    expect(msgs[1].text).toBe('World');
  });

  it('parses plain text lines', () => {
    const plain = `Hello there\nThis is suspicious\nI will hurt you`;
    const msgs = parseMessages(plain);
    expect(msgs.length).toBe(3);
  });

  it('handles quoted CSV fields with commas', () => {
    const csv = `sender,timestamp,text\nAlice,2026-10-01,"Hello, world"`;
    const msgs = parseMessages(csv);
    expect(msgs[0].text).toBe('Hello, world');
  });

  it('returns empty array for empty input', () => {
    expect(parseMessages('')).toEqual([]);
    expect(parseMessages('   ')).toEqual([]);
  });
});

// ── evaluateMethod ────────────────────────────────────────────

describe('evaluateMethod', () => {
  it('computes perfect precision/recall when all correct', () => {
    const preds: ScoredMessage[] = [
      { ...makeMsg('safe', 'A', 'id1'), score: 0, level: 'safe', matchedRules: [] },
      { ...makeMsg('threat', 'B', 'id2'), score: 0.9, level: 'threat', matchedRules: [] },
    ];
    const labels = [
      { id: 'id1', label: 'safe' as const },
      { id: 'id2', label: 'threat' as const },
    ];
    const result = evaluateMethod(preds, labels);
    expect(result.tp).toBe(1);
    expect(result.fp).toBe(0);
    expect(result.fn).toBe(0);
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.f1).toBe(1);
  });

  it('computes zero f1 when no true positives', () => {
    const preds: ScoredMessage[] = [
      { ...makeMsg('safe', 'A', 'id1'), score: 0, level: 'safe', matchedRules: [] },
    ];
    const labels = [{ id: 'id1', label: 'threat' as const }];
    const result = evaluateMethod(preds, labels);
    expect(result.tp).toBe(0);
    expect(result.fn).toBe(1);
    expect(result.f1).toBe(0);
  });
});
