import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import Header from "../components/Header";
import StatusBanner from "../components/StatusBanner";
import {
  LabsPanel,
  MedicationsPanel,
  NursingPanel,
  VentilatorPanel,
  VitalsGrid
} from "../components/PatientPanels";
import { useStore } from "../store";
import { HOSPITALS, hospitalById, STATES } from "../data/hospitals";
import { Hospital, Patient, Severity, State } from "../types";
import { assess } from "../lib/ai";

const ControlRoom: React.FC = () => {
  const navigate = useNavigate();
  const { hospitalId, patientId } = useParams();
  const patients = useStore((s) => s.patients);
  const alerts = useStore((s) => s.alerts);
  const orders = useStore((s) => s.orders);
  const ackedAlerts = useStore((s) => s.ackedAlerts);
  const addOrder = useStore((s) => s.addOrder);

  const [activeState, setActiveState] = useState<State | "all">("all");

  const totals = useMemo(() => {
    const red = patients.filter((p) => p.status === "red").length;
    const amber = patients.filter((p) => p.status === "amber").length;
    const green = patients.length - red - amber;
    const onlineHospitals = HOSPITALS.filter((h) => h.online).length;
    return { red, amber, green, onlineHospitals, totalHospitals: HOSPITALS.length };
  }, [patients]);

  const hospital = hospitalId ? hospitalById(hospitalId) : undefined;
  const patient = patientId ? patients.find((p) => p.id === patientId) : undefined;

  const visibleHospitals = useMemo(
    () => (activeState === "all" ? HOSPITALS : HOSPITALS.filter((h) => h.state === activeState)),
    [activeState]
  );

  const liveAlerts = useMemo(
    () =>
      alerts
        .filter((a) => a.level === "red" && !ackedAlerts[a.id])
        .slice()
        .reverse(),
    [alerts, ackedAlerts]
  );

  return (
    <div className="min-h-full bg-navy-950 text-white">
      <Header
        subtitle="Remote intensivist command screen"
        variant="dark"
        back={{ to: "/", label: "Home" }}
      />

      {/* Stats bar */}
      <div className="bg-navy-900 border-b border-navy-800 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-6 text-sm">
          <Stat label="Patients" value={patients.length} />
          <Stat label="RED alerts" value={totals.red} colour="bg-status-red" />
          <Stat label="AMBER" value={totals.amber} colour="bg-status-amber" />
          <Stat label="Stable" value={totals.green} colour="bg-status-green" />
          <Stat
            label="Hospitals online"
            value={`${totals.onlineHospitals}/${totals.totalHospitals}`}
          />
          <div className="ml-auto flex gap-1.5">
            <FilterChip active={activeState === "all"} onClick={() => setActiveState("all")}>
              All NE
            </FilterChip>
            {STATES.map((s) => (
              <FilterChip key={s} active={activeState === s} onClick={() => setActiveState(s)}>
                {s}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-4 grid grid-cols-12 gap-4">
        {/* LEFT — hospital tiles */}
        <section className={clsx("col-span-12", patient ? "lg:col-span-3" : hospital ? "lg:col-span-4" : "lg:col-span-8")}>
          <SectionTitle>State map · Hospitals</SectionTitle>
          <div className={clsx("grid gap-2", patient ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3")}>
            {visibleHospitals.map((h) => (
              <HospitalTile
                key={h.id}
                hospital={h}
                patients={patients.filter((p) => p.hospitalId === h.id)}
                active={hospital?.id === h.id}
                onClick={() => navigate(`/control-room/${h.id}`)}
              />
            ))}
          </div>
        </section>

        {/* MIDDLE — beds at selected hospital */}
        {hospital && (
          <section className={clsx("col-span-12", patient ? "lg:col-span-3" : "lg:col-span-4")}>
            <SectionTitle>{hospital.name} — beds</SectionTitle>
            <div className="space-y-2">
              {patients
                .filter((p) => p.hospitalId === hospital.id)
                .map((p) => (
                  <BedRow
                    key={p.id}
                    patient={p}
                    active={patient?.id === p.id}
                    onClick={() => navigate(`/control-room/${hospital.id}/${p.id}`)}
                  />
                ))}
            </div>
          </section>
        )}

        {/* RIGHT — patient detail */}
        {patient && (
          <section className="col-span-12 lg:col-span-6 space-y-4">
            <PatientDetail patientId={patient.id} onSubmitOrder={(text) => addOrder(patient.id, text)} ordersForPatient={orders[patient.id] || []} />
          </section>
        )}

        {/* BOTTOM ROW — alert queue (always visible) */}
        <section className="col-span-12">
          <SectionTitle>RED alert queue</SectionTitle>
          {liveAlerts.length === 0 ? (
            <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 text-slate-300 text-sm">
              No active RED alerts. {totals.amber} AMBER cases under review.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {liveAlerts.slice(0, 9).map((a) => {
                const p = patients.find((x) => x.id === a.patientId);
                const h = hospitalById(a.hospitalId);
                if (!p || !h) return null;
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/control-room/${h.id}/${p.id}`)}
                    className="text-left bg-status-red/10 hover:bg-status-red/20 border border-status-red/40 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2 text-status-red font-bold text-sm">
                      <span className="h-2 w-2 rounded-full bg-status-red animate-pulse" />
                      RED
                      <span className="text-slate-300 font-medium ml-auto">
                        {timeAgo(a.at)}
                      </span>
                    </div>
                    <div className="font-semibold mt-1">
                      {p.name} · {h.name}
                    </div>
                    <div className="text-sm text-slate-300 line-clamp-2">{a.message}</div>
                    <div className="mt-2 flex gap-2">
                      <span className="pill bg-white/10 text-white">{p.bedNumber}</span>
                      <span className="pill bg-white/10 text-white">{p.diagnosis.split(" — ")[0]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

// ---------- pieces ----------

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">{children}</h2>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; colour?: string }> = ({
  label,
  value,
  colour
}) => (
  <div className="flex items-center gap-2">
    {colour && <span className={clsx("h-2.5 w-2.5 rounded-full", colour)} />}
    <span className="text-2xl font-bold tabular-nums">{value}</span>
    <span className="text-slate-300">{label}</span>
  </div>
);

const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children
}) => (
  <button
    onClick={onClick}
    className={clsx(
      "rounded-full px-3 py-1 text-xs font-semibold border",
      active
        ? "bg-white text-navy-950 border-white"
        : "bg-navy-800 text-slate-200 border-navy-700 hover:bg-navy-700"
    )}
  >
    {children}
  </button>
);

const HospitalTile: React.FC<{
  hospital: Hospital;
  patients: Patient[];
  active: boolean;
  onClick: () => void;
}> = ({ hospital, patients, active, onClick }) => {
  const counts: Record<Severity, number> = { green: 0, amber: 0, red: 0 };
  patients.forEach((p) => counts[p.status]++);
  const hasRed = counts.red > 0;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "text-left rounded-xl border p-3 transition relative",
        active
          ? "bg-white text-navy-950 border-white"
          : hasRed
          ? "bg-navy-900 border-status-red/60 hover:border-status-red"
          : counts.amber > 0
          ? "bg-navy-900 border-status-amber/60 hover:border-status-amber"
          : "bg-navy-900 border-navy-800 hover:border-navy-700"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-tight">{hospital.name}</div>
        {!hospital.online ? (
          <span className="pill bg-status-red/20 text-status-red border border-status-red/40">OFFLINE</span>
        ) : hasRed ? (
          <span className="pill bg-status-red text-white animate-pulse">RED</span>
        ) : null}
      </div>
      <div className="mt-1 text-xs opacity-70">{hospital.state} · {hospital.id}</div>
      <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-status-green" />{counts.green}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-status-amber" />{counts.amber}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-status-red" />{counts.red}
        </span>
        <span className="ml-auto opacity-70">{patients.length} pts</span>
      </div>
    </button>
  );
};

const BedRow: React.FC<{ patient: Patient; active: boolean; onClick: () => void }> = ({
  patient,
  active,
  onClick
}) => {
  const colour =
    patient.status === "red" ? "border-status-red bg-status-red/10" :
    patient.status === "amber" ? "border-status-amber bg-status-amber/10" :
    "border-navy-800 bg-navy-900";
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left rounded-xl border p-3 transition",
        active ? "bg-white text-navy-950 border-white" : `${colour} hover:border-white/60`
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "h-2.5 w-2.5 rounded-full",
            patient.status === "red"
              ? "bg-status-red animate-pulse"
              : patient.status === "amber"
              ? "bg-status-amber"
              : "bg-status-green"
          )}
        />
        <span className="font-semibold">{patient.bedNumber} · {patient.name}</span>
        <span className="ml-auto text-xs opacity-80 tabular-nums">
          MAP {patient.vitals.map} · SpO2 {patient.vitals.spo2}%
        </span>
      </div>
      <div className="text-xs mt-1 opacity-80">{patient.diagnosis}</div>
    </button>
  );
};

const PRESET_ORDERS = [
  "Increase noradrenaline by 0.05 mcg/kg/min",
  "Add vasopressin 0.03 U/min",
  "Give 500 mL crystalloid bolus, reassess in 15 min",
  "Send repeat ABG and lactate",
  "Increase FiO2 by 10%",
  "Initiate prone position for 16 hours",
  "Start broad-spectrum antibiotics within 1 hour"
];

const PatientDetail: React.FC<{
  patientId: string;
  onSubmitOrder: (text: string) => void;
  ordersForPatient: ReturnType<typeof useStore.getState>["orders"][string];
}> = ({ patientId, onSubmitOrder, ordersForPatient }) => {
  const patient = useStore((s) => s.patients.find((p) => p.id === patientId));
  const [orderText, setOrderText] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  if (!patient) return null;
  const briefing = assess(patient).briefing;

  const submit = (text: string) => {
    if (!text.trim()) return;
    onSubmitOrder(text.trim());
    setOrderText("");
  };

  return (
    <>
      <div className="bg-white text-navy-950 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Patient detail</div>
            <div className="text-2xl font-bold">
              {patient.name}{" "}
              <span className="text-slate-500 font-medium text-base">
                {patient.age}{patient.sex}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {patient.diagnosis} · {patient.bedNumber}
            </div>
          </div>
          <button onClick={() => setVideoOpen((v) => !v)} className="btn-primary !py-2 !px-3 text-sm">
            {videoOpen ? "End video call" : "📹 Start video call"}
          </button>
        </div>

        {videoOpen && (
          <div className="rounded-xl bg-navy-950 text-white aspect-video flex items-center justify-center overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950" />
            <div className="relative text-center">
              <div className="h-12 w-12 mx-auto rounded-full border-4 border-white/30 border-t-white animate-spin" />
              <div className="mt-3 font-semibold">Connecting to bedside camera…</div>
              <div className="text-xs text-slate-300">{patient.bedNumber} · audio + video</div>
            </div>
            <div className="absolute bottom-3 left-3 pill bg-status-red text-white">● LIVE</div>
            <div className="absolute bottom-3 right-3 text-xs text-slate-300">SIMULATED</div>
          </div>
        )}

        <div className="rounded-lg bg-navy-950 text-white p-3 text-sm leading-relaxed">
          <div className="text-xs uppercase tracking-wide text-slate-300 font-semibold mb-1">AI briefing</div>
          {briefing}
        </div>

        <StatusBanner patient={patient} variant="compact" />

        <VitalsGrid patient={patient} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <VentilatorPanel patient={patient} />
          <LabsPanel patient={patient} />
          <MedicationsPanel patient={patient} />
          <NursingPanel patient={patient} />
        </div>

        {/* Order entry */}
        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
          <div className="font-semibold mb-2">Send order to bedside</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_ORDERS.map((o) => (
              <button
                key={o}
                onClick={() => submit(o)}
                className="text-xs bg-white border border-slate-300 rounded-full px-3 py-1 hover:border-navy-700"
              >
                {o}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(orderText)}
              placeholder="Type a custom order…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
            />
            <button onClick={() => submit(orderText)} className="btn-primary">
              Send
            </button>
          </div>
          {ordersForPatient.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {ordersForPatient
                .slice()
                .reverse()
                .slice(0, 5)
                .map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full",
                        o.acknowledged ? "bg-status-green" : "bg-status-amber animate-pulse"
                      )}
                    />
                    <span className="text-slate-500 text-xs tabular-nums w-12">
                      {new Date(o.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span>{o.text}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {o.acknowledged ? "Acknowledged" : "Pending bedside"}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default ControlRoom;
