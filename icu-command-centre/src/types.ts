export type Severity = "green" | "amber" | "red";

export type State = "Meghalaya" | "Assam" | "Nagaland" | "Manipur" | "Sikkim";

export interface Hospital {
  id: string;
  name: string;
  state: State;
  district?: string;
  online: boolean;
}

export interface Vitals {
  hr: number;          // beats per minute
  sbp: number;         // systolic
  dbp: number;         // diastolic
  map: number;         // mean arterial pressure
  spo2: number;        // %
  rr: number;          // breaths per minute
  temp: number;        // °C
}

export interface VentilatorSettings {
  mode: "AC" | "SIMV" | "PSV" | "CPAP" | "Off";
  fio2: number;        // %
  peep: number;        // cmH2O
  tidalVolume: number; // mL
  rate: number;        // breaths per min
  peakPressure: number;// cmH2O
}

export interface Labs {
  lactate: number;     // mmol/L
  creatinine: number;  // mg/dL
  wbc: number;         // x10^9/L
  hb: number;          // g/dL
  platelets: number;   // x10^9/L
  ph: number;
  pao2: number;        // mmHg
  paco2: number;       // mmHg
  hco3: number;        // mEq/L
  takenAt: string;     // ISO time
}

export interface Medication {
  name: string;
  dose: string;        // human readable e.g. "0.2 mcg/kg/min"
  rate: string;        // e.g. "8 mL/hr"
  startedAt: string;   // ISO
}

export interface NursingAction {
  at: string;          // ISO
  text: string;
}

export interface Order {
  id: string;
  at: string;          // ISO
  by: string;          // intensivist name
  text: string;
  acknowledged: boolean;
}

export interface AlertEvent {
  id: string;
  at: string;          // ISO
  level: Severity;     // amber | red
  message: string;
  patientId: string;
  hospitalId: string;
  acknowledged?: boolean;
}

export type VitalsHistoryPoint = {
  t: number; // epoch ms
  hr: number;
  sbp: number;
  dbp: number;
  spo2: number;
  rr: number;
  map: number;
  temp: number;
};

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: "M" | "F";
  diagnosis: string;
  bedNumber: string;
  hospitalId: string;
  admittedAt: string;        // ISO
  baseline: {
    profile: "stable" | "deteriorating" | "critical";
  };
  vitals: Vitals;
  ventilator: VentilatorSettings;
  labs: Labs;
  medications: Medication[];
  nursing: NursingAction[];
  history: VitalsHistoryPoint[];
  status: Severity;
  statusReason: string;       // plain language
  recommendation?: string;    // AMBER recommendation
  redAlertedAt?: string;      // ISO when escalated
}
