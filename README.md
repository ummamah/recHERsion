# recHERsion – Women's Safety Companion

> **A calm, trustworthy, zero-budget Progressive Web App for personal safety, proactive journey monitoring, and harassment pattern intelligence.** Built for a 24-hour hackathon using 100% free tiers, open-source libraries, and native browser APIs.

---

## 🌟 Vision & Design Principles

Safety apps shouldn't create panic. When someone feels vulnerable, high-contrast flashing red screens increase stress. **recHERsion** adopts a calm, discreet, and reassuring design language:
- **Calm, Earthy Palette**: Soft teals, sage greens, warm parchment backgrounds, and subtle alert badges.
- **Privacy by Default**: Zero third-party trackers, zero advertising SDKs, and zero cloud lock-in. All location calculations, PIN hashing, and message analysis happen directly on the user's device.
- **Zero Budget**: Powered entirely by free web standards (Geolocation API, Web Speech API, Web Crypto API, Web Share API, OpenStreetMap via Leaflet, and localStorage).

---

## 🚀 Core Features

### 1. 🆘 Discreet SOS & Emergency Broadcast
- **Instant Activation**: Prominent 3-second abortable countdown prevents accidental false alarms.
- **Multi-channel Dispatch**: Uses native `navigator.share` and pre-populated `sms:` / WhatsApp links containing live coordinates, accuracy radius, timestamp, and OpenStreetMap permalink.
- **Silent Fallback**: Works seamlessly without native app store installation.

### 2. 🚶 JourneyGuard (Battery-Friendly Journey Check-Ins)
- **No Battery-Draining Continuous GPS**: Unlike traditional tracking apps that drain phone batteries, JourneyGuard requests GPS coordinates **only during scheduled check-in intervals** or upon a missed check-in trigger.
- **Safety Window & Escalation**: User sets an expected arrival duration and interval (e.g., check in every 10 minutes). If a check-in is missed, an alarm sounds with a grace period before automatic SOS escalation.
- **Arrival Confirmation**: One-tap "I have arrived safely" alert to trusted contacts with arrival timestamp.

### 3. 🗺️ Risk Radar & Safe Zones
- **OpenStreetMap & Leaflet Integration**: Fully functional interactive map with zero API keys required.
- **Offline Map Tile Caching**: Configured service worker caches OpenStreetMap tiles for offline navigation in low-connectivity areas.
- **Dynamic Risk Engine**: Computes localized danger levels using a weighted multi-factor equation:
  $$\text{Risk} = \min(1, \text{BaseZoneRisk} \times \text{ProximityFactor} \times \text{TimeOfDayWeight} + \sum \text{IncidentRecencyWeight})$$
  Night hours (10 PM – 5 AM) dynamically increase zone sensitivity.

### 4. 🔍 TraceHer: Harassment & Threat Pattern Intelligence
A pure TypeScript, explainable pattern engine designed to flag cyber-harassment, phishing, and coercion **without slow, expensive, or hallucinating ML models**:
- **Explainable Rule Categories**:
  - Explicit Threats & Violence
  - Indirect Threats & Intimidation
  - Coercion & Extortion ("or else", demands for money/media)
  - Authority Impersonation (police, banks, government bodies)
  - Suspicious Links (URL shorteners, raw IP address hosts, lookalike domains)
  - Credential & OTP Harvesting (passwords, PINs, bank accounts)
  - Pressure & Urgency Tactics
- **Timeline & Escalation Grouping**: Groups messages by sender over time windows (e.g. 24h), detecting message volume surges and score escalation gradients.
- **Method A vs Method B Benchmark**:
  - **Method A**: Evaluates each message in isolation.
  - **Method B (Group-Aware)**: Integrates repeat-contact frequency and escalating tone to detect stalker patterns that appear innocuous individually.
- **Synthetic Benchmark Dataset**: Includes 330+ pre-labelled messages (`public/data/synthetic-messages.csv`) evaluating Precision, Recall, and F1 score right inside the app.
- **User Corrections**: Users can override classifications, saved to local storage for auditable feedback loops.

### 5. 🎙️ VoiceHelp (Hands-Free Hotword Detection)
- Utilizes the browser's native **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`).
- Listens for configurable distress phrases (e.g., *"help me"*, *"emergency"*, *"danger"*).
- Triggers an abortable 5-second emergency countdown with audio feedback.

### 6. 🔒 Vault & PIN Protection
- **Salted PBKDF2 / SHA-256 Hashing**: Uses browser-native `crypto.subtle` with random salt generation. Cleartext PINs are never stored.
- **App Lock**: Protects trusted contact details, trip history, and harassment logs from unauthorized snooping if the phone is handed over.

---

## 🛠️ Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | React 19 + TypeScript | Type safety, component modularity, instant responsiveness |
| **Bundler** | Vite 8 + `vite-plugin-pwa` | Lightning-fast HMR, automated Workbox PWA service worker |
| **Styling** | Modern Plain CSS (CSS Variables) | Zero runtime overhead, clean tokens, responsive mobile-first shell |
| **Mapping** | Leaflet + OpenStreetMap | 100% free, no credit card or Google Maps API key required |
| **Security** | Web Crypto API (`crypto.subtle`) | Cryptographically secure salted hashing directly in browser |
| **Speech** | Web Speech API | Zero-cost client-side speech recognition |
| **Testing** | Vitest | Fast unit testing for risk and rule engine algorithms |
| **Linting** | Oxlint | High-performance Rust-based linter |

---

## ⚠️ Limitations & Free/Open-Source Trade-Offs

Because this is a zero-budget Progressive Web App built on standard web technologies, certain native mobile OS features have specific constraints:

1. **Background SMS Sending**:
   - *Limitation*: Browsers cannot silently send SMS in the background without user confirmation due to mobile operating system security sandboxes.
   - *Our Solution*: One-tap dispatch using `sms:?body=...` and native `navigator.share` pre-fills the emergency contact, coordinates, and distress message with a single confirmation touch.
2. **Background Speech Recognition on Mobile**:
   - *Limitation*: Mobile Safari and Chrome on Android may suspend speech recognition when the browser is placed in the background or the screen turns off.
   - *Our Solution*: VoiceHelp provides clear UI indicators when active and recommends keeping the screen awake during high-risk walking legs, supplemented by check-in timers.
3. **Continuous Background Geolocation**:
   - *Limitation*: Continuous high-accuracy GPS tracking drains mobile battery rapidly and mobile browsers throttle background location queries.
   - *Our Solution*: JourneyGuard's check-in architecture queries location strictly on check-in events, drastically preserving battery life.
4. **Tile Caching Volume**:
   - *Limitation*: OpenStreetMap public tile servers have fair-use policies.
   - *Our Solution*: Service worker caches up to 200 tiles with 7-day expiration for the user's active geographic radius.

---

## 🧪 Testing & Validation

The codebase includes automated unit tests covering risk math, Haversine distance, temporal weights, message rule scoring, grouping, and evaluation metrics:

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Build production bundle & PWA assets
npm run build
```

---

## 📱 Getting Started Locally

```bash
# 1. Clone repository
git clone https://github.com/your-org/recHERsion.git
cd recHERsion/women-safety-app

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` on your browser or mobile phone (via local network IP). Add to Home Screen to run full-screen as a PWA.
