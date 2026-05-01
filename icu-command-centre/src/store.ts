import { create } from "zustand";
import { AlertEvent, NursingAction, Order, Patient, VitalsHistoryPoint } from "./types";
import { buildPatients } from "./data/patients";
import { HOSPITALS, hospitalById } from "./data/hospitals";
import { assess } from "./lib/ai";
import { load, save } from "./lib/storage";

interface StoreState {
  patients: Patient[];
  alerts: AlertEvent[];
  orders: Record<string, Order[]>;     // patientId -> orders
  online: boolean;
  hospitalId: string;                  // hospital "logged in" for bedside
  ackedAlerts: Record<string, true>;
  setOnline: (v: boolean) => void;
  setHospital: (id: string) => void;
  tick: () => void;
  addOrder: (patientId: string, text: string, by?: string) => void;
  ackOrder: (patientId: string, orderId: string) => void;
  addNursing: (patientId: string, text: string) => void;
  ackAlert: (alertId: string) => void;
}

const initialPatients = buildPatients().map((p) => {
  const a = assess(p);
  const redAlertedAt =
    a.status === "red"
      ? new Date(Date.now() - Math.floor(Math.random() * 8 * 60_000)).toISOString()
      : undefined;
  return {
    ...p,
    status: a.status,
    statusReason: a.reason,
    recommendation: a.recommendation,
    redAlertedAt
  };
});

const initialAlerts: AlertEvent[] = [];
for (const p of initialPatients) {
  if (p.status === "amber" || p.status === "red") {
    initialAlerts.push({
      id: `${p.id}-init`,
      at: new Date().toISOString(),
      level: p.status,
      message: p.statusReason,
      patientId: p.id,
      hospitalId: p.hospitalId
    });
  }
}

const persistedOrders = load<Record<string, Order[]>>("orders", {});
const persistedAck = load<Record<string, true>>("ackedAlerts", {});
const persistedHospital = load<string>("hospitalId", "MEG-01");

export const useStore = create<StoreState>((set, get) => ({
  patients: initialPatients,
  alerts: initialAlerts,
  orders: persistedOrders,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  hospitalId: persistedHospital,
  ackedAlerts: persistedAck,
  setOnline: (v) => set({ online: v }),
  setHospital: (id) => {
    save("hospitalId", id);
    set({ hospitalId: id });
  },
  tick: () => {
    const state = get();
    const newAlerts: AlertEvent[] = [];
    const updated = state.patients.map((p) => stepPatient(p, newAlerts));
    set({
      patients: updated,
      alerts: newAlerts.length ? [...state.alerts, ...newAlerts].slice(-200) : state.alerts
    });
  },
  addOrder: (patientId, text, by = "Dr. Bhattacharya (Control Room)") => {
    const order: Order = {
      id: `${patientId}-${Date.now()}`,
      at: new Date().toISOString(),
      by,
      text,
      acknowledged: false
    };
    const orders = { ...get().orders, [patientId]: [...(get().orders[patientId] || []), order] };
    save("orders", orders);
    set({ orders });
  },
  ackOrder: (patientId, orderId) => {
    const list = (get().orders[patientId] || []).map((o) =>
      o.id === orderId ? { ...o, acknowledged: true } : o
    );
    const orders = { ...get().orders, [patientId]: list };
    save("orders", orders);
    set({ orders });
  },
  addNursing: (patientId, text) => {
    const action: NursingAction = { at: new Date().toISOString(), text };
    const patients = get().patients.map((p) =>
      p.id === patientId ? { ...p, nursing: [...p.nursing, action].slice(-25) } : p
    );
    set({ patients });
  },
  ackAlert: (alertId) => {
    const ackedAlerts = { ...get().ackedAlerts, [alertId]: true as const };
    save("ackedAlerts", ackedAlerts);
    set({ ackedAlerts });
  }
}));

// ---- per-tick simulation ------------------------------------------------

function stepPatient(p: Patient, newAlerts: AlertEvent[]): Patient {
  const v = { ...p.vitals };
  const profile = p.baseline.profile;

  // Random walk around current vitals, with profile-based bias.
  const drift = (mean: number, variance: number, bias: number = 0) =>
    mean + (Math.random() - 0.5) * variance + bias;

  const bias = profile === "stable" ? 0 : profile === "deteriorating" ? 0.4 : 0.9;

  v.hr = clamp(Math.round(drift(v.hr, 4, bias * 0.3)), 35, 180);
  v.sbp = clamp(Math.round(drift(v.sbp, 5, -bias * 0.5)), 60, 200);
  v.dbp = clamp(Math.round(drift(v.dbp, 3, -bias * 0.3)), 35, 120);
  v.map = Math.round(v.dbp + (v.sbp - v.dbp) / 3);
  v.spo2 = clamp(Math.round(drift(v.spo2, 1.2, -bias * 0.15)), 70, 100);
  v.rr = clamp(Math.round(drift(v.rr, 1.6, bias * 0.2)), 8, 45);
  v.temp = clampF(drift(v.temp, 0.15, bias * 0.02), 35, 41);

  // Slowly evolve labs every ~30 ticks.
  let labs = p.labs;
  if (Math.random() < 0.03) {
    labs = {
      ...labs,
      lactate: clampF(labs.lactate + (profile === "stable" ? -0.1 : 0.15), 0.5, 12)
    };
  }

  const newPoint: VitalsHistoryPoint = {
    t: Date.now(),
    hr: v.hr,
    sbp: v.sbp,
    dbp: v.dbp,
    map: v.map,
    spo2: v.spo2,
    rr: v.rr,
    temp: v.temp
  };
  const history = [...p.history, newPoint].slice(-150);

  const next: Patient = { ...p, vitals: v, labs, history };

  const a = assess(next);
  next.status = a.status;
  next.statusReason = a.reason;
  next.recommendation = a.recommendation;

  // Generate a new alert if status escalated
  if (a.status !== p.status && (a.status === "amber" || a.status === "red")) {
    newAlerts.push({
      id: `${p.id}-${Date.now()}`,
      at: new Date().toISOString(),
      level: a.status,
      message: a.reason,
      patientId: p.id,
      hospitalId: p.hospitalId
    });
    if (a.status === "red") next.redAlertedAt = new Date().toISOString();
  }
  if (p.status === "red" && a.status === "red" && !p.redAlertedAt) {
    next.redAlertedAt = new Date().toISOString();
  }
  return next;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function clampF(n: number, lo: number, hi: number): number {
  return Math.round(Math.max(lo, Math.min(hi, n)) * 10) / 10;
}

// Convenience selectors
export const selectAllHospitals = () => HOSPITALS;
export const selectHospital = (id: string) => hospitalById(id);
export const selectPatientsByHospital = (id: string) => (s: StoreState) =>
  s.patients.filter((p) => p.hospitalId === id);
