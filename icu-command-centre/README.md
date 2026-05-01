# ICU Command Centre

AI-powered TeleICU platform for the Northeast India 10BedICU programme.

Three layers in one app:

- **Layer 1 — Bedside AI** (`/bedside`): tablet-optimised dashboard at every bed. Live vitals, ventilator, labs, drips, AI status indicator (GREEN / AMBER / RED) with plain-language reason and recommendation, control-room orders, nursing log. Works offline.
- **Layer 2 — Control Room AI** (`/control-room`): desktop dashboard for the remote intensivist. State map of all 70 ICUs across Meghalaya, Assam, Nagaland, Manipur and Sikkim. Hospital tiles → bed list → patient detail with AI briefing, video-call simulator, order entry, and a chronological RED alert queue.
- **Layer 3 — Staff Support AI** (`/support`): mobile-friendly decision support for nurses and junior doctors. Deterioration flows, ventilator alarm explainer, drug dosing calculator (Noradrenaline, Vasopressin, Propofol etc. at standard ISCCM concentrations) and ISCCM protocol checklists for sepsis, ARDS, shock, AKI and head injury. 100% offline.

## Run locally

```bash
cd icu-command-centre
npm install
npm start            # http://localhost:3000
npm run build        # production bundle in build/
```

## Stack

- React 18 + TypeScript
- Tailwind CSS
- React Router 6
- Recharts (vitals sparklines)
- Zustand (state)
- Service Worker for offline app shell, localStorage for orders / ack state

## Demo data

`src/data/patients.ts` defines 8 clinical archetypes (septic shock, ARDS, stroke, polytrauma, DKA + AKI, severe head injury, COPD exacerbation, post-partum haemorrhage with DIC). 70 hospitals are seeded from the real 10BedICU distribution and each is given 2–3 patients deterministically. The simulator (`src/store.ts → tick`) updates vitals every 4 seconds with profile-specific drift, and the rule-based AI in `src/lib/ai.ts` (NEWS2 + Surviving Sepsis triggers) re-classifies patients on every tick — so AMBER and RED alerts fire naturally during a demo.

## Disclaimer

Decision-support content is adapted from ISCCM and Surviving Sepsis Campaign guidelines for demonstration only. Not a substitute for clinical judgement.
