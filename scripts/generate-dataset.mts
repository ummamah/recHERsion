// ============================================================
// Synthetic dataset generator
// Run: npx ts-node scripts/generate-dataset.ts
//   or: node --loader ts-node/esm scripts/generate-dataset.ts
// ============================================================
// Generates 300+ labelled messages to public/data/synthetic-messages.csv
// Labels: safe | suspicious | threat
// incident_id groups related escalation sequences

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Seed data pools ─────────────────────────────────────────

const SENDERS = [
  'Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank',
  'Ivy', 'Jake', 'Karen', 'Leo', 'Mona', 'Nick', 'Olivia', 'Pete',
  'Quinn', 'Rose', 'Sam', 'Tara',
];

const SAFE_MESSAGES = [
  'Hey, are you free this weekend?',
  'Can we reschedule our meeting to Monday?',
  'Thanks for your help yesterday!',
  "I'll be there in 10 minutes.",
  'Did you see the match last night?',
  'Happy birthday! Hope you have a great day.',
  'Can you recommend a good restaurant nearby?',
  'Just checking in — how are you doing?',
  'Great work on the project!',
  'Let me know when you arrive.',
  'Do you want to grab coffee tomorrow?',
  'I left my umbrella at your place, can I pick it up?',
  'See you at 6 PM!',
  'Thanks for the info.',
  'Good morning! Ready for the day?',
  'Call me when you get a chance.',
  'Dinner at 8? Let me know.',
  'Looking forward to the trip!',
  'The report looks good. Nice work.',
  'Can you share the meeting notes?',
  "Let's catch up soon.",
  'Hope your interview went well!',
  "I'll send the files over shortly.",
  'Thanks for covering for me.',
  'Great to hear from you!',
];

const SUSPICIOUS_MESSAGES = [
  'Calling from bank RBI. Account suspended. Verify card details now.',
  'Your account will be blocked in 24 hours. Send OTP immediately.',
  'This is an official notice. You owe outstanding taxes. Pay now.',
  'You have won a lottery. Send your bank details to claim prize.',
  'New phone number. Please update your contacts. Need help urgently.',
  'Your delivery is on hold. Confirm address and pay small fee at bit.ly/abc123.',
  'Limited time offer! Claim your reward before it expires today.',
  'Your Netflix account will be suspended. Update payment at tinyurl.com/xz9',
  'I have information about you. Meet me or I will share it.',
  'You must respond within one hour or consequences will follow.',
  'This is your final reminder. No other way out. Pay now.',
  'Send me your photos or I will post old ones online.',
  'Verify your identity by sharing Aadhaar number. Official process.',
  'Your UPI PIN has been compromised. Re-enter at this link to secure.',
  'Police case registered against you. Call immediately to avoid arrest.',
];

const THREAT_MESSAGES = [
  "You'll regret not replying. I will find you.",
  'I will hurt you if you don\'t do what I say.',
  'Watch your back. You can\'t hide from me.',
  'Send me the money or I will destroy your reputation.',
  'If you don\'t comply I will make your life miserable.',
  'This is not a joke. Send your OTP now or else.',
  'I know where you live. Don\'t test me.',
  'Last chance. Pay or I will post everything.',
  'You will suffer the consequences for ignoring me.',
  'Don\'t push me. You won\'t like what happens next.',
  'I will hurt you and your family if you go to police.',
  'You\'re mine. Nobody can help you.',
  'Send the photos immediately or I will send those to everyone.',
  'If you don\'t, things will get very bad. I promise.',
  'No one can save you. I have everything I need.',
];

// ── Escalation sequences (multi-message patterns) ──────────

const ESCALATION_SEQUENCES: Array<{ messages: string[]; label: string }> = [
  {
    label: 'threat',
    messages: [
      'Hey, just wanted to say hi.',
      'You haven\'t replied. Are you ignoring me?',
      'This is rude. I expect a response.',
      'If you don\'t reply I will come to your office.',
      'You\'ll regret this. I will make sure of it.',
    ],
  },
  {
    label: 'suspicious',
    messages: [
      'Hi, this is your bank. We noticed unusual activity.',
      'Your account may be compromised. Please verify.',
      'Share your OTP to secure your account now.',
      'This is urgent. Last chance to protect your account.',
    ],
  },
  {
    label: 'threat',
    messages: [
      'Hi! Do you remember me from college?',
      'We should meet up sometime.',
      'I\'ve been following your posts. You look great.',
      'Why are you ignoring me? I know where you work.',
      'Send me your number or I will find other ways to contact you.',
      'You can\'t hide from me. Don\'t make this harder.',
    ],
  },
  {
    label: 'suspicious',
    messages: [
      'Congratulations! You\'ve been selected for our prize draw.',
      'To claim, send a small processing fee of Rs. 500.',
      'Transfer to: bit.ly/claim-now. Offer expires today!',
    ],
  },
  {
    label: 'safe',
    messages: [
      'Hey, running 10 minutes late.',
      'Almost there — traffic is bad.',
      'Just parked! Coming in now.',
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoTimestamp(baseMs: number, offsetMinutes: number) {
  return new Date(baseMs + offsetMinutes * 60000).toISOString();
}

function escapeCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Generate dataset ─────────────────────────────────────────

const rows: string[] = ['id,sender,timestamp,text,url,ip,label,incident_id'];
let msgIdx = 0;
const baseMs = new Date('2026-10-01T08:00:00').getTime();

function addRow(
  sender: string,
  timestamp: string,
  text: string,
  label: string,
  incidentId: string,
  url = '',
  ip = ''
) {
  const id = `msg_${String(msgIdx++).padStart(4, '0')}`;
  rows.push([id, sender, timestamp, escapeCsv(text), url, ip, label, incidentId].join(','));
}

// 1. Safe messages (100)
for (let i = 0; i < 100; i++) {
  const sender = randPick(SENDERS);
  const ts = isoTimestamp(baseMs, i * 15 + randInt(0, 10));
  addRow(sender, ts, randPick(SAFE_MESSAGES), 'safe', `inc_safe_${i}`);
}

// 2. Single suspicious messages (70)
for (let i = 0; i < 70; i++) {
  const sender = randPick(SENDERS);
  const ts = isoTimestamp(baseMs + 5 * 24 * 3600000, i * 20 + randInt(0, 15));
  const msg = randPick(SUSPICIOUS_MESSAGES);
  const url = msg.includes('bit.ly') || msg.includes('tinyurl') ? '' : '';
  addRow(sender, ts, msg, 'suspicious', `inc_susp_${i}`, url);
}

// 3. Single threat messages (60)
for (let i = 0; i < 60; i++) {
  const sender = 'ThreatSender_' + randInt(1, 10);
  const ts = isoTimestamp(baseMs + 10 * 24 * 3600000, i * 25 + randInt(0, 20));
  addRow(sender, ts, randPick(THREAT_MESSAGES), 'threat', `inc_threat_${i}`);
}

// 4. Escalation sequences (80+ messages)
let incSeqIdx = 0;
for (let rep = 0; rep < 8; rep++) {
  for (const seq of ESCALATION_SEQUENCES) {
    const sender = 'Seq_' + incSeqIdx + '_' + randPick(SENDERS);
    const incId = `inc_seq_${incSeqIdx}`;
    const startMs = baseMs + (15 + rep) * 24 * 3600000 + incSeqIdx * 3600000;
    seq.messages.forEach((text, j) => {
      const ts = isoTimestamp(startMs, j * randInt(5, 30));
      addRow(sender, ts, text, seq.label, incId);
    });
    incSeqIdx++;
  }
}

// Write output
const outPath = join(__dirname, '..', 'public', 'data', 'synthetic-messages.csv');
writeFileSync(outPath, rows.join('\n'), 'utf8');
console.log(`✓ Generated ${rows.length - 1} messages → ${outPath}`);
