// ============================================================
// TraceHer Rule Engine – pure TypeScript, no ML
// ============================================================
import type {
  ParsedMessage, ScoredMessage, MatchedRule,
  SenderGroup, MessageLabel
} from '../types';

// ── Rule definitions ────────────────────────────────────────

interface Rule {
  id: string;
  label: string;
  weight: number;
  test: (msg: ParsedMessage) => string | null; // null = no match; string = matched excerpt
}

function matchKeywords(text: string, patterns: RegExp[]): string | null {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    const m = lower.match(p);
    if (m) return m[0];
  }
  return null;
}

const RULES: Rule[] = [
  // ── Threats ────────────────────────────────────────────────
  {
    id: 'threat_explicit',
    label: 'Explicit threat',
    weight: 0.90,
    test: msg => matchKeywords(msg.text, [
      /i('ll| will) (hurt|kill|harm|destroy|ruin|beat|attack)/i,
      /you('ll|'ll| will) regret/i,
      /watch (your back|out for yourself)/i,
      /make (you|your life) (suffer|miserable|hell)/i,
      /find (you|where you live)/i,
      /you (can't|cannot) hide/i,
    ]),
  },
  {
    id: 'threat_indirect',
    label: 'Indirect threat',
    weight: 0.55,
    test: msg => matchKeywords(msg.text, [
      /something (bad|wrong|terrible) (will|might|could) happen/i,
      /(consequences|result|price) (for|of) (this|that|what)/i,
      /don'?t (push|test|try) me/i,
      /you won'?t like (what|how)/i,
    ]),
  },
  // ── Coercion ───────────────────────────────────────────────
  {
    id: 'coercion_ifthen',
    label: 'Coercion: if/then',
    weight: 0.65,
    test: msg => matchKeywords(msg.text, [
      /if you (don'?t|do(n't)? comply|refuse|ignore)/i,
      /or (else|i will|things will)/i,
      /you (must|have to|need to) (do|send|give|comply)/i,
      /no (choice|option|other way)/i,
    ]),
  },
  {
    id: 'coercion_demand',
    label: 'Coercion: demand',
    weight: 0.50,
    test: msg => matchKeywords(msg.text, [
      /(send|give) me (money|cash|photos|pics|images|nudes)/i,
      /pay (me|now|immediately|within)/i,
      /transfer (funds|money|amount)/i,
    ]),
  },
  // ── Impersonation ──────────────────────────────────────────
  {
    id: 'impersonation_authority',
    label: 'Impersonation: authority',
    weight: 0.70,
    test: msg => matchKeywords(msg.text, [
      /(calling|writing|contacting) (from|on behalf of) (bank|rbi|police|government|income tax|cbi|nsa|irs)/i,
      /official (notice|letter|communication|warning)/i,
      /your account (will be|has been) (blocked|suspended|frozen)/i,
    ]),
  },
  {
    id: 'impersonation_known',
    label: 'Impersonation: known contact',
    weight: 0.45,
    test: msg => matchKeywords(msg.text, [
      /this is (your|a) (friend|colleague|classmate|neighbour)/i,
      /new (number|sim|phone)/i,
      /(urgent|emergency|please) (help|assist|lend)/i,
    ]),
  },
  // ── Suspicious URLs ────────────────────────────────────────
  {
    id: 'url_shortened',
    label: 'Suspicious URL: shortener',
    weight: 0.55,
    test: msg => {
      const text = (msg.text + ' ' + (msg.url ?? '')).toLowerCase();
      return matchKeywords(text, [
        /\b(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|short\.ly|tiny\.cc|is\.gd|rb\.gy|cutt\.ly|shorturl)/i,
      ]);
    },
  },
  {
    id: 'url_ip',
    label: 'Suspicious URL: IP address',
    weight: 0.80,
    test: msg => {
      const text = (msg.text + ' ' + (msg.url ?? '')).toLowerCase();
      return matchKeywords(text, [
        /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      ]);
    },
  },
  {
    id: 'url_lookalike',
    label: 'Suspicious URL: lookalike domain',
    weight: 0.65,
    test: msg => {
      const text = (msg.text + ' ' + (msg.url ?? '')).toLowerCase();
      return matchKeywords(text, [
        /\b(paypa1|g00gle|arnazon|micosoft|rn\.com|1nstagram|faceb00k|netf1ix)/i,
        /\.(tk|ml|ga|cf|pw|top|xyz|click|link|site|online)\b/i,
      ]);
    },
  },
  // ── Sensitive info requests ─────────────────────────────────
  {
    id: 'sensitive_otp',
    label: 'Requests sensitive info: OTP / password',
    weight: 0.85,
    test: msg => matchKeywords(msg.text, [
      /(share|send|provide|enter|tell me) (your )?(otp|pin|password|passcode|cvv|secret code)/i,
      /one.time (password|pin|code)/i,
    ]),
  },
  {
    id: 'sensitive_bank',
    label: 'Requests sensitive info: bank / card',
    weight: 0.80,
    test: msg => matchKeywords(msg.text, [
      /(account|card|bank) (number|details|info|credentials)/i,
      /(credit|debit) card.*(number|details|cvv)/i,
      /upi (pin|id|details)/i,
    ]),
  },
  {
    id: 'sensitive_personal',
    label: 'Requests sensitive info: personal',
    weight: 0.55,
    test: msg => matchKeywords(msg.text, [
      /(home |current |your )?(address|location|workplace)/i,
      /(send|share) (photos|pictures|selfie|images) of (yourself|you)/i,
      /aadhaar|pan card|passport (number|copy)/i,
    ]),
  },
  // ── Persistent contact ─────────────────────────────────────
  // (evaluated at group level; this rule marks the message)
  {
    id: 'urgency_pressure',
    label: 'Urgency / pressure tactics',
    weight: 0.45,
    test: msg => matchKeywords(msg.text, [
      /(immediately|right now|asap|within (the next|an) hour|don'?t (delay|wait))/i,
      /(last chance|final (warning|notice|reminder))/i,
      /(act now|limited time|expires? (soon|today|in \d+))/i,
    ]),
  },
  // ── Emotional manipulation ─────────────────────────────────
  {
    id: 'manipulation_emotional',
    label: 'Emotional manipulation',
    weight: 0.35,
    test: msg => matchKeywords(msg.text, [
      /you'?re (the only one|my only hope)/i,
      /(nobody|no one) (cares|loves|understands) (about )?you/i,
      /you'?ll (be alone|regret this|lose everything)/i,
    ]),
  },
];

// ── Score a single message ──────────────────────────────────

export function scoreMessage(msg: ParsedMessage): ScoredMessage {
  const matchedRules: MatchedRule[] = [];
  let rawScore = 0;

  for (const rule of RULES) {
    const excerpt = rule.test(msg);
    if (excerpt !== null) {
      matchedRules.push({
        ruleId: rule.id,
        reason: `${rule.label}: "${excerpt}"`,
        weight: rule.weight,
      });
      rawScore += rule.weight;
    }
  }

  // Normalise: multiple hits shouldn't exceed 1
  // Use a diminishing-returns formula
  const score = matchedRules.length === 0
    ? 0
    : Math.min(1, 1 - Math.exp(-rawScore));

  const level: MessageLabel =
    score < 0.25 ? 'safe' :
    score < 0.60 ? 'suspicious' :
    'threat';

  return { ...msg, score, level, matchedRules };
}

// ── Group by sender ─────────────────────────────────────────

export function groupBySender(messages: ScoredMessage[]): SenderGroup[] {
  const map = new Map<string, ScoredMessage[]>();
  for (const m of messages) {
    const key = m.sender.toLowerCase().trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }

  const groups: SenderGroup[] = [];
  for (const [sender, msgs] of map.entries()) {
    // Sort by time
    const sorted = [...msgs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const escalation = sorted.map(m => m.score);

    // Pattern bonus
    let patternBonus = 0;

    // Repetition: many messages in 24h
    const firstTime = new Date(sorted[0].timestamp).getTime();
    const lastTime  = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const windowH = (lastTime - firstTime) / 3600000;
    if (sorted.length >= 5 && windowH <= 24) patternBonus += 0.15;
    if (sorted.length >= 10 && windowH <= 24) patternBonus += 0.10;

    // Escalation: score increasing over time
    let escBonus = 0;
    for (let i = 1; i < escalation.length; i++) {
      if (escalation[i] > escalation[i - 1]) escBonus += 0.05;
    }
    patternBonus += Math.min(0.20, escBonus);

    // Multiple indicator types
    const ruleTypes = new Set(sorted.flatMap(m => m.matchedRules.map(r => r.ruleId.split('_')[0])));
    if (ruleTypes.size >= 3) patternBonus += 0.10;

    const avgScore = sorted.reduce((s, m) => s + m.score, 0) / sorted.length;
    const groupScore = Math.min(1, avgScore + patternBonus);

    groups.push({ sender, messages: sorted, groupScore, patternBonus, escalation });
  }

  return groups.sort((a, b) => b.groupScore - a.groupScore);
}

// ── Parse CSV/TXT ───────────────────────────────────────────

export function parseMessages(raw: string): ParsedMessage[] {
  const lines = raw.trim().split('\n');
  if (lines.length === 0) return [];

  // Detect CSV (has commas) vs plain text lines
  const firstLine = lines[0];
  const isCSV = firstLine.includes(',');

  if (isCSV) {
    // Expected columns: sender, timestamp, text[, url][, ip]
    const header = firstLine.toLowerCase().split(',').map(h => h.trim());
    const idxSender    = header.indexOf('sender');
    const idxTimestamp = header.indexOf('timestamp');
    const idxText      = header.indexOf('text');
    const idxUrl       = header.indexOf('url');
    const idxIp        = header.indexOf('ip');

    return lines.slice(1).map((line, i) => {
      // Handle quoted fields
      const cols = parseCSVLine(line);
      return {
        id: `msg_${i}`,
        sender:    cols[idxSender]    ?? 'unknown',
        timestamp: cols[idxTimestamp] ?? new Date().toISOString(),
        text:      cols[idxText]      ?? line,
        url:       idxUrl >= 0 ? cols[idxUrl] : undefined,
        ip:        idxIp  >= 0 ? cols[idxIp]  : undefined,
      };
    }).filter(m => m.text.trim().length > 0);
  }

  // Plain text: one message per line
  return lines.map((line, i) => ({
    id: `msg_${i}`,
    sender: 'unknown',
    timestamp: new Date().toISOString(),
    text: line,
  })).filter(m => m.text.trim().length > 0);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Method A: single-message classification ─────────────────

export function classifyMethodA(messages: ParsedMessage[]): ScoredMessage[] {
  return messages.map(scoreMessage);
}

// ── Method B: multi-incident (group-aware) ──────────────────

export function classifyMethodB(messages: ParsedMessage[]): ScoredMessage[] {
  const scored = messages.map(scoreMessage);
  const groups = groupBySender(scored);

  // Re-score each message using its group bonus
  const groupMap = new Map<string, SenderGroup>();
  for (const g of groups) groupMap.set(g.sender.toLowerCase().trim(), g);

  return scored.map(m => {
    const g = groupMap.get(m.sender.toLowerCase().trim());
    if (!g || g.patternBonus === 0) return m;
    const boosted = Math.min(1, m.score + g.patternBonus * 0.5);
    const level: MessageLabel =
      boosted < 0.25 ? 'safe' :
      boosted < 0.60 ? 'suspicious' :
      'threat';
    return { ...m, score: boosted, level };
  });
}

// ── Evaluation metrics ──────────────────────────────────────

export function evaluateMethod(
  predictions: ScoredMessage[],
  labels: Array<{ id: string; label: MessageLabel }>
): { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number } {
  const labelMap = new Map(labels.map(l => [l.id, l.label]));
  let tp = 0, fp = 0, fn = 0;

  for (const pred of predictions) {
    const truth = labelMap.get(pred.id);
    if (!truth) continue;
    const predPositive = pred.level !== 'safe';
    const truePositive = truth !== 'safe';
    if (predPositive && truePositive) tp++;
    else if (predPositive && !truePositive) fp++;
    else if (!predPositive && truePositive) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  return { precision, recall, f1, tp, fp, fn };
}
