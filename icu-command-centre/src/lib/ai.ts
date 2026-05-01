import { Patient, Severity } from "../types";

export interface Assessment {
  status: Severity;
  reason: string;
  recommendation?: string;
  briefing: string;
}

// Simplified rule-based "AI" inspired by NEWS2 + Surviving Sepsis triggers.
// Real product would use a trained model, but this gives clinically plausible
// behaviour for the demo.
export function assess(p: Patient): Assessment {
  const v = p.vitals;
  const trend = trendInfo(p);
  let red = false;
  let amber = false;
  const redReasons: string[] = [];
  const amberReasons: string[] = [];

  // RED triggers
  if (v.spo2 < 88) { red = true; redReasons.push(`SpO2 ${v.spo2}% — critical hypoxia`); }
  if (v.map < 60) { red = true; redReasons.push(`MAP ${v.map} — severe hypotension`); }
  if (v.sbp < 85) { red = true; redReasons.push(`SBP ${v.sbp} — severe hypotension`); }
  if (v.hr > 140) { red = true; redReasons.push(`HR ${v.hr} — extreme tachycardia`); }
  if (v.hr < 40) { red = true; redReasons.push(`HR ${v.hr} — extreme bradycardia`); }
  if (v.rr > 30) { red = true; redReasons.push(`RR ${v.rr} — respiratory failure`); }
  if (p.labs.lactate >= 4) { red = true; redReasons.push(`Lactate ${p.labs.lactate.toFixed(1)} — tissue hypoperfusion`); }
  if (p.labs.ph < 7.25) { red = true; redReasons.push(`pH ${p.labs.ph.toFixed(2)} — severe acidosis`); }

  // AMBER triggers
  if (!red) {
    if (v.spo2 < 92) amberReasons.push(`SpO2 ${v.spo2}% — falling`);
    if (v.map < 65) amberReasons.push(`MAP ${v.map} — below target`);
    if (v.sbp < 100) amberReasons.push(`SBP ${v.sbp} — borderline`);
    if (v.hr > 120) amberReasons.push(`HR ${v.hr} — sustained tachycardia`);
    if (v.rr > 24) amberReasons.push(`RR ${v.rr} — increased work of breathing`);
    if (v.temp >= 38.5) amberReasons.push(`Temp ${v.temp.toFixed(1)}°C — pyrexia`);
    if (p.labs.lactate >= 2) amberReasons.push(`Lactate ${p.labs.lactate.toFixed(1)} — elevated`);
    if (trend.mapDrop >= 8) amberReasons.push(`MAP dropped ${trend.mapDrop} over 90 min`);
    if (trend.spo2Drop >= 3) amberReasons.push(`SpO2 dropped ${trend.spo2Drop} over 90 min`);
    if (amberReasons.length) amber = true;
  }

  let status: Severity = "green";
  let reason = "Patient stable";
  let recommendation: string | undefined;

  if (red) {
    status = "red";
    reason = `CRITICAL — ${redReasons[0]}. Control Room alerted.`;
    recommendation = recommendForRed(p, redReasons);
  } else if (amber) {
    status = "amber";
    reason = amberReasons[0] + " — review now";
    recommendation = recommendForAmber(p, amberReasons);
  }

  return {
    status,
    reason,
    recommendation,
    briefing: makeBriefing(p, status, trend)
  };
}

function recommendForAmber(p: Patient, reasons: string[]): string {
  if (reasons.some((r) => r.startsWith("MAP"))) {
    const onNor = p.medications.some((m) => m.name.toLowerCase().includes("noradrenaline"));
    if (onNor) return "BP dropping — increase noradrenaline by 0.05 mcg/kg/min, recheck MAP in 10 min, consider adding vasopressin.";
    return "BP dropping — give 250 mL crystalloid bolus, send lactate, prepare to start noradrenaline.";
  }
  if (reasons.some((r) => r.startsWith("SpO2"))) {
    return "SpO2 falling — increase FiO2 by 10%, check tube position, send ABG, consider proning.";
  }
  if (reasons.some((r) => r.startsWith("Lactate"))) {
    return "Lactate elevated — reassess perfusion, check fluid responsiveness, recheck lactate in 2 hours.";
  }
  if (reasons.some((r) => r.startsWith("HR"))) {
    return "Sustained tachycardia — check temp, pain, volume status; ECG to rule out new arrhythmia.";
  }
  if (reasons.some((r) => r.startsWith("Temp"))) {
    return "Pyrexia — blood cultures from two sites, paracetamol 1 g IV, review lines.";
  }
  if (reasons.some((r) => r.startsWith("RR"))) {
    return "Respiratory rate up — listen to chest, ABG, chest X-ray, consider non-invasive support.";
  }
  return "Reassess in 15 minutes; escalate if not improving.";
}

function recommendForRed(_p: Patient, reasons: string[]): string {
  if (reasons.some((r) => r.startsWith("SpO2"))) {
    return "100% FiO2, suction, bag if needed. Prepare to intubate or escalate ventilator settings.";
  }
  if (reasons.some((r) => r.startsWith("MAP")) || reasons.some((r) => r.startsWith("SBP"))) {
    return "500 mL crystalloid bolus, up-titrate noradrenaline aggressively, prepare vasopressin.";
  }
  if (reasons.some((r) => r.startsWith("Lactate"))) {
    return "Aggressive resuscitation, source control, recheck lactate in 1 hour.";
  }
  if (reasons.some((r) => r.startsWith("HR"))) {
    return "12-lead ECG now, treat underlying rhythm, prepare for cardioversion if unstable.";
  }
  return "Critical — bedside intensivist taking over via control room.";
}

function makeBriefing(p: Patient, status: Severity, trend: ReturnType<typeof trendInfo>): string {
  const sex = p.sex === "M" ? "male" : "female";
  const vasopressors = p.medications
    .filter((m) => /noradrenaline|vasopressin|dopamine|adrenaline|epinephrine/i.test(m.name))
    .map((m) => `${m.name} ${m.dose}`)
    .join(", ");
  const onVent = p.ventilator.mode !== "Off";
  const ventLine = onVent
    ? ` Ventilated on ${p.ventilator.mode}, FiO2 ${p.ventilator.fio2}%, PEEP ${p.ventilator.peep}.`
    : "";
  const trendLine =
    status === "amber" || status === "red"
      ? ` MAP ${trend.mapNow} (was ${trend.mapPrev} 90 min ago), SpO2 ${p.vitals.spo2}%.`
      : ` Vitals stable: MAP ${p.vitals.map}, SpO2 ${p.vitals.spo2}%.`;
  const suggest =
    status === "red"
      ? " Suggest: take over remotely, escalate vasopressor and consider second-line support."
      : status === "amber"
      ? ` Suggest: ${recommendForAmber(p, ["MAP"])}`
      : " No action needed; continue monitoring.";
  return `${p.age}-year-old ${sex}, ${p.diagnosis.toLowerCase()}${vasopressors ? `, on ${vasopressors}` : ""}.${ventLine}${trendLine}${suggest}`;
}

function trendInfo(p: Patient) {
  const h = p.history;
  if (h.length < 18) {
    return { mapNow: p.vitals.map, mapPrev: p.vitals.map, mapDrop: 0, spo2Drop: 0 };
  }
  const now = h[h.length - 1];
  const prev = h[h.length - 18]; // ~90 min ago at 5-min resolution
  return {
    mapNow: now.map,
    mapPrev: prev.map,
    mapDrop: Math.max(0, prev.map - now.map),
    spo2Drop: Math.max(0, prev.spo2 - now.spo2)
  };
}
