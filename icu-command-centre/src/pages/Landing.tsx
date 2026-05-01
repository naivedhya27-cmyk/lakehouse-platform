import React from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import { useStore } from "../store";
import { HOSPITALS } from "../data/hospitals";

const Landing: React.FC = () => {
  const patients = useStore((s) => s.patients);
  const totalRed = patients.filter((p) => p.status === "red").length;
  const totalAmber = patients.filter((p) => p.status === "amber").length;
  const onlineHospitals = HOSPITALS.filter((h) => h.online).length;

  return (
    <div className="min-h-full bg-slate-50">
      <Header subtitle="TeleICU for the Northeast 10BedICU programme" />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-navy-950">Activate the hardware. Save the lives.</h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            70 ICUs across 5 Northeast states. {patients.length} ventilated and critical patients live
            now. {onlineHospitals}/{HOSPITALS.length} hospitals reporting in real time.
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <Stat colour="bg-status-red" label="RED alerts" value={totalRed} />
            <Stat colour="bg-status-amber" label="AMBER alerts" value={totalAmber} />
            <Stat colour="bg-status-green" label="Stable" value={patients.length - totalRed - totalAmber} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <RoleCard
            to="/bedside"
            badge="Layer 1"
            title="I am at the Bedside"
            desc="Tablet view at each bed. Live vitals, vent, labs, drips, AI status, control-room alerts."
            accent="bg-emerald-50 text-emerald-900 border-emerald-200"
          />
          <RoleCard
            to="/control-room"
            badge="Layer 2"
            title="I am in the Control Room"
            desc="Remote intensivist command screen. State map, AI briefings, order entry, video, alert queue."
            accent="bg-navy-950 text-white border-navy-900"
            dark
          />
          <RoleCard
            to="/support"
            badge="Layer 3"
            title="I need Clinical Support"
            desc="Mobile decision support for nurses and doctors. Deterioration flows, vent alarms, dosing, ISCCM protocols."
            accent="bg-amber-50 text-amber-900 border-amber-200"
          />
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Demo build. Mock data only. Decision support content adapted from ISCCM and Surviving Sepsis Campaign guidelines —
          not a substitute for clinician judgement.
        </p>
      </main>
    </div>
  );
};

const Stat: React.FC<{ colour: string; label: string; value: number }> = ({ colour, label, value }) => (
  <div className="flex items-center gap-2">
    <span className={`h-2.5 w-2.5 rounded-full ${colour}`} />
    <span className="font-semibold text-navy-950">{value}</span>
    <span className="text-slate-500">{label}</span>
  </div>
);

const RoleCard: React.FC<{
  to: string;
  badge: string;
  title: string;
  desc: string;
  accent: string;
  dark?: boolean;
}> = ({ to, badge, title, desc, accent, dark }) => (
  <Link
    to={to}
    className={`block rounded-2xl border ${accent} p-6 transition hover:-translate-y-0.5 hover:shadow-md`}
  >
    <div className={`text-xs font-bold uppercase tracking-wide ${dark ? "text-slate-300" : "opacity-70"}`}>
      {badge}
    </div>
    <div className="mt-2 text-2xl font-bold">{title}</div>
    <div className={`mt-2 text-sm ${dark ? "text-slate-300" : "opacity-80"}`}>{desc}</div>
    <div className={`mt-6 text-sm font-semibold ${dark ? "text-white" : ""}`}>Open →</div>
  </Link>
);

export default Landing;
