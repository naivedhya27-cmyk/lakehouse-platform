import React from "react";
import clsx from "clsx";
import { Patient } from "../types";
import Sparkline from "./Sparkline";

export const VitalsGrid: React.FC<{ patient: Patient; large?: boolean }> = ({ patient, large }) => {
  const v = patient.vitals;
  const cells = [
    { label: "Heart Rate", value: v.hr, unit: "bpm", colour: "#ef4444", series: patient.history.map((h) => h.hr) },
    {
      label: "Blood Pressure",
      value: `${v.sbp}/${v.dbp}`,
      unit: "mmHg",
      colour: "#1e3a66",
      series: patient.history.map((h) => h.sbp)
    },
    { label: "MAP", value: v.map, unit: "mmHg", colour: "#0ea5e9", series: patient.history.map((h) => h.map) },
    { label: "SpO2", value: v.spo2, unit: "%", colour: "#22c55e", series: patient.history.map((h) => h.spo2) },
    { label: "Resp Rate", value: v.rr, unit: "/min", colour: "#a855f7", series: patient.history.map((h) => h.rr) },
    { label: "Temp", value: v.temp.toFixed(1), unit: "°C", colour: "#f59e0b", series: patient.history.map((h) => h.temp) }
  ];
  return (
    <div className={clsx("grid gap-3", large ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-3")}>
      {cells.map((c) => (
        <div key={c.label} className="card !p-3">
          <div className="text-xs text-slate-500 font-medium">{c.label}</div>
          <div className="flex items-baseline gap-1">
            <div className={clsx("font-bold tabular-nums", large ? "text-3xl" : "text-2xl")} style={{ color: c.colour }}>
              {c.value}
            </div>
            <div className="text-xs text-slate-400">{c.unit}</div>
          </div>
          <div className="mt-1">
            <Sparkline data={c.series} colour={c.colour} height={36} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const VentilatorPanel: React.FC<{ patient: Patient }> = ({ patient }) => {
  const v = patient.ventilator;
  const items: [string, string | number][] =
    v.mode === "Off"
      ? [["Mode", "Off — spontaneous breathing"]]
      : [
          ["Mode", v.mode],
          ["FiO2", `${v.fio2}%`],
          ["PEEP", `${v.peep} cmH2O`],
          ["Tidal Volume", `${v.tidalVolume} mL`],
          ["Rate", `${v.rate} /min`],
          ["Peak Pressure", `${v.peakPressure} cmH2O`]
        ];
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-navy-950">Ventilator</div>
        {v.mode !== "Off" && <div className="pill bg-navy-950 text-white">{v.mode}</div>}
      </div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        {items.map(([k, val]) => (
          <div key={k} className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-500">{k}</span>
            <span className="font-semibold tabular-nums">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const LabsPanel: React.FC<{ patient: Patient }> = ({ patient }) => {
  const l = patient.labs;
  const rows: [string, string | number, string?][] = [
    ["Lactate", l.lactate.toFixed(1), "mmol/L"],
    ["Creatinine", l.creatinine.toFixed(1), "mg/dL"],
    ["WBC", l.wbc.toFixed(1), "x10⁹/L"],
    ["Hb", l.hb.toFixed(1), "g/dL"],
    ["Platelets", l.platelets, "x10⁹/L"],
    ["pH", l.ph.toFixed(2)],
    ["PaO2", l.pao2, "mmHg"],
    ["PaCO2", l.paco2, "mmHg"],
    ["HCO3", l.hco3, "mEq/L"]
  ];
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-navy-950">Labs</div>
        <div className="text-xs text-slate-400">{new Date(l.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-sm">
        {rows.map(([k, val, unit]) => (
          <div key={k} className="flex flex-col">
            <span className="text-slate-500 text-xs">{k}</span>
            <span className="font-semibold tabular-nums">
              {val}
              {unit && <span className="text-slate-400 text-xs font-normal ml-1">{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MedicationsPanel: React.FC<{ patient: Patient }> = ({ patient }) => (
  <div className="card">
    <div className="font-semibold text-navy-950 mb-2">Active medications & drips</div>
    {patient.medications.length === 0 ? (
      <div className="text-sm text-slate-500">No active drips.</div>
    ) : (
      <ul className="text-sm divide-y divide-slate-100">
        {patient.medications.map((m, i) => (
          <li key={i} className="py-2 flex items-baseline justify-between gap-2">
            <span className="font-semibold text-navy-900">{m.name}</span>
            <span className="text-slate-700 tabular-nums">{m.dose}</span>
            <span className="text-slate-400 tabular-nums w-20 text-right">{m.rate}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const NursingPanel: React.FC<{ patient: Patient }> = ({ patient }) => (
  <div className="card">
    <div className="font-semibold text-navy-950 mb-2">Nursing actions</div>
    <ul className="text-sm space-y-1.5 max-h-44 overflow-y-auto">
      {patient.nursing
        .slice()
        .reverse()
        .map((n, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-slate-400 tabular-nums shrink-0 w-12">
              {new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-slate-700">{n.text}</span>
          </li>
        ))}
    </ul>
  </div>
);
