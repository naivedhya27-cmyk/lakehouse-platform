import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import Header from "../components/Header";
import { DETERIORATION, DRUGS, PROTOCOLS, VENT_ALARMS, DrugRecipe } from "../data/protocols";

const Support: React.FC = () => (
  <div className="min-h-full bg-amber-50/40">
    <Header subtitle="Staff Decision Support — works offline" back={{ to: "/", label: "Home" }} />
    <main className="max-w-3xl mx-auto p-4">
      <Routes>
        <Route index element={<SupportHome />} />
        <Route path="deteriorating" element={<DeteriorationFlow />} />
        <Route path="ventilator" element={<VentilatorFlow />} />
        <Route path="dosing" element={<DosingCalculator />} />
        <Route path="protocols" element={<ProtocolList />} />
        <Route path="protocols/:id" element={<ProtocolDetail />} />
        <Route path="*" element={<SupportHome />} />
      </Routes>
    </main>
  </div>
);

// ---------- HOME ----------
const SupportHome: React.FC = () => {
  const tiles: Array<{ to: string; label: string; sub: string; bg: string }> = [
    { to: "deteriorating", label: "Patient Deteriorating", sub: "Step-by-step actions for any worsening", bg: "bg-status-red text-white" },
    { to: "ventilator", label: "Ventilator Alarm", sub: "What is the alarm telling me?", bg: "bg-navy-950 text-white" },
    { to: "dosing", label: "Drug Dosing", sub: "Calculator for vasopressors, sedation, insulin", bg: "bg-status-amber text-white" },
    { to: "protocols", label: "Protocol Guide", sub: "ISCCM checklists for sepsis, ARDS, AKI…", bg: "bg-status-green text-white" }
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-950 mb-1">What do you need help with?</h1>
      <p className="text-slate-600 mb-4 text-sm">Tap a card. All content works offline.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={clsx("rounded-2xl p-6 min-h-[140px] flex flex-col justify-between shadow-sm", t.bg)}
          >
            <div className="text-2xl font-bold leading-tight">{t.label}</div>
            <div className="opacity-90 text-sm mt-2">{t.sub}</div>
          </Link>
        ))}
      </div>
      <CallControlRoom className="mt-6" />
    </div>
  );
};

// ---------- DETERIORATION ----------
const DeteriorationFlow: React.FC = () => {
  const [picked, setPicked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const symptoms = useMemo(() => DETERIORATION.filter((s) => picked.includes(s.id)), [picked]);

  return (
    <div>
      <BackBar to="/support" label="Back to support" />
      <h1 className="text-2xl font-bold text-navy-950">Patient deteriorating</h1>
      <p className="text-slate-600 text-sm">Tick everything that applies right now.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {DETERIORATION.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={clsx(
              "text-left rounded-xl border p-3 min-h-[60px] font-semibold",
              picked.includes(s.id)
                ? "bg-navy-950 text-white border-navy-950"
                : "bg-white text-navy-950 border-slate-300"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        disabled={picked.length === 0}
        onClick={() => setRevealed(true)}
        className={clsx(
          "btn w-full mt-4 text-lg",
          picked.length === 0 ? "bg-slate-200 text-slate-400" : "btn-primary"
        )}
      >
        Show steps
      </button>
      {revealed && symptoms.length > 0 && (
        <div className="mt-5 space-y-4">
          {symptoms.map((s) => (
            <div key={s.id} className="card">
              <div className="font-bold text-status-red mb-2">{s.label}</div>
              <ol className="list-decimal list-inside space-y-1.5 text-base">
                {s.steps.map((step, i) => (
                  <li key={i} className="leading-snug">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <CallControlRoom />
        </div>
      )}
    </div>
  );
};

// ---------- VENTILATOR ----------
const VentilatorFlow: React.FC = () => {
  const [id, setId] = useState<string>("");
  const alarm = VENT_ALARMS.find((a) => a.id === id);
  return (
    <div>
      <BackBar to="/support" label="Back to support" />
      <h1 className="text-2xl font-bold text-navy-950">Ventilator alarm</h1>
      <p className="text-slate-600 text-sm">Choose the alarm shown on the ventilator.</p>
      <select
        className="mt-3 w-full text-base rounded-lg border border-slate-300 px-3 py-3 bg-white"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">— Select an alarm —</option>
        {VENT_ALARMS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      {alarm && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-status-red text-white p-4">
            <div className="text-xs uppercase tracking-wide font-semibold opacity-90">Do this first</div>
            <div className="text-2xl font-bold">{alarm.firstAction}</div>
          </div>
          <div className="card text-base">
            <div className="font-semibold text-navy-950 mb-1">Why & next steps</div>
            <p className="text-slate-700 leading-relaxed">{alarm.detail}</p>
          </div>
          <CallControlRoom />
        </div>
      )}
    </div>
  );
};

// ---------- DRUG DOSING ----------
const DosingCalculator: React.FC = () => {
  const [drugName, setDrugName] = useState<string>(DRUGS[0].name);
  const [weight, setWeight] = useState<number>(60);
  const drug = DRUGS.find((d) => d.name === drugName)!;
  const [dose, setDose] = useState<number>(drug.defaultDose);

  const onChangeDrug = (name: string) => {
    const d = DRUGS.find((x) => x.name === name)!;
    setDrugName(name);
    setDose(d.defaultDose);
  };

  const calc = computeRate(drug, weight, dose);

  return (
    <div>
      <BackBar to="/support" label="Back to support" />
      <h1 className="text-2xl font-bold text-navy-950">Drug dosing calculator</h1>
      <p className="text-slate-600 text-sm">All standard ICU concentrations. No internet needed.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Field label="Drug">
          <select
            className="w-full rounded-lg border border-slate-300 p-3 bg-white"
            value={drugName}
            onChange={(e) => onChangeDrug(e.target.value)}
          >
            {DRUGS.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Patient weight (kg)">
          <input
            type="number"
            min={1}
            max={200}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(Math.max(1, Math.min(200, Number(e.target.value) || 0)))}
            className="w-full rounded-lg border border-slate-300 p-3 bg-white"
          />
        </Field>
        <Field label={`Dose (${drug.unit})`}>
          <div>
            <input
              type="range"
              min={drug.minDose}
              max={drug.maxDose}
              step={(drug.maxDose - drug.minDose) / 100}
              value={dose}
              onChange={(e) => setDose(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={dose}
                step={drug.unit.includes("mcg/kg/min") ? 0.05 : 0.01}
                onChange={(e) => setDose(Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-slate-300 p-2 bg-white tabular-nums"
              />
              <span className="text-slate-500 text-sm">{drug.unit}</span>
            </div>
          </div>
        </Field>
        <Field label="Concentration">
          <div className="rounded-lg bg-white border border-slate-300 p-3 text-sm">
            {drug.concentrationLabel}
          </div>
        </Field>
      </div>

      <div className="mt-4 rounded-2xl bg-navy-950 text-white p-5">
        <div className="text-xs uppercase tracking-wide opacity-80 font-semibold">Pump rate</div>
        <div className="text-5xl font-bold tabular-nums mt-1">
          {calc.mlPerHr.toFixed(2)} <span className="text-2xl font-normal opacity-80">mL/hr</span>
        </div>
        <div className="mt-3 text-sm opacity-80">
          = {calc.amountPerHr.toFixed(1)} {drug.amountUnit}/hr at {dose}
          {drug.unit.replace("U", " U").replace("mcg", " mcg")} for a {weight} kg patient.
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-3">{drug.notes}</p>
      <CallControlRoom className="mt-4" />
    </div>
  );
};

function computeRate(drug: DrugRecipe, weightKg: number, dose: number) {
  // Convert dose to "drug units per hour" (mcg, mg, U)
  let amountPerHr = 0;
  switch (drug.unit) {
    case "mcg/kg/min":
      amountPerHr = dose * weightKg * 60; // mcg/hr
      break;
    case "mcg/min":
      amountPerHr = dose * 60;
      break;
    case "mcg/kg/hr":
      amountPerHr = dose * weightKg;
      break;
    case "mg/kg/hr":
      amountPerHr = dose * weightKg * 1000; // -> mcg if needed
      break;
    case "U/min":
      amountPerHr = dose * 60;
      break;
    case "U/kg/hr":
      amountPerHr = dose * weightKg;
      break;
  }
  // Reconcile units: amountPerMl is mcg / mg / U per mL.
  const mlPerHr = amountPerHr / drug.amountPerMl;
  return { amountPerHr, mlPerHr };
}

// ---------- PROTOCOLS ----------
const ProtocolList: React.FC = () => (
  <div>
    <BackBar to="/support" label="Back to support" />
    <h1 className="text-2xl font-bold text-navy-950">Protocol guide</h1>
    <p className="text-slate-600 text-sm">ISCCM-aligned checklists.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {PROTOCOLS.map((p) => (
        <Link
          key={p.id}
          to={`/support/protocols/${p.id}`}
          className="card hover:border-navy-700 transition"
        >
          <div className="font-bold text-navy-950">{p.name}</div>
          <div className="text-xs text-slate-500 mt-1">{p.source}</div>
          <div className="text-xs text-slate-400 mt-2">{p.steps.length} steps</div>
        </Link>
      ))}
    </div>
  </div>
);

const ProtocolDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const protocol = PROTOCOLS.find((p) => p.id === id);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  useEffect(() => {
    if (!protocol) navigate("/support/protocols");
  }, [protocol, navigate]);
  if (!protocol) return null;
  const completed = Object.values(checked).filter(Boolean).length;
  return (
    <div>
      <BackBar to="/support/protocols" label="All protocols" />
      <h1 className="text-2xl font-bold text-navy-950">{protocol.name}</h1>
      <div className="text-xs text-slate-500 mb-3">{protocol.source}</div>
      <div className="card space-y-3">
        {protocol.steps.map((s, i) => (
          <label key={i} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
              className="h-6 w-6 mt-0.5 rounded border-slate-300 accent-navy-900 shrink-0"
            />
            <div className={clsx("flex-1", checked[i] && "line-through text-slate-400")}>
              <div className="font-semibold">
                {i + 1}. {s.text}
              </div>
              {s.detail && <div className="text-sm text-slate-600 mt-0.5">{s.detail}</div>}
            </div>
          </label>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-status-amber/15 border border-status-amber/40 p-3 text-sm">
        <span className="font-bold text-status-amber">Escalation: </span>
        <span className="text-navy-950">{protocol.escalation}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {completed}/{protocol.steps.length} steps complete
      </div>
      <CallControlRoom className="mt-4" />
    </div>
  );
};

// ---------- shared ----------
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{label}</div>
    {children}
  </label>
);

const BackBar: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link to={to} className="text-sm text-navy-800 font-semibold mb-2 inline-block">
    ← {label}
  </Link>
);

const CallControlRoom: React.FC<{ className?: string }> = ({ className }) => {
  const [calling, setCalling] = useState(false);
  return (
    <div className={className}>
      <button
        onClick={() => setCalling(true)}
        className="w-full rounded-xl bg-status-red text-white py-4 font-bold text-lg shadow-md active:scale-[0.99]"
      >
        📞 Call Control Room
      </button>
      {calling && (
        <div className="mt-2 rounded-lg bg-navy-950 text-white p-3 text-sm flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-status-green animate-pulse" />
          <span>Connecting to on-duty intensivist… you will be called back within 60 seconds.</span>
        </div>
      )}
    </div>
  );
};

export default Support;
