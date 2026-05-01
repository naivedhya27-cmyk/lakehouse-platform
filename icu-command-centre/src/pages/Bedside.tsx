import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { hospitalById, HOSPITALS } from "../data/hospitals";
import clsx from "clsx";
import { Severity } from "../types";

const STATUS_COLOURS: Record<Severity, string> = {
  green: "bg-status-green",
  amber: "bg-status-amber",
  red: "bg-status-red"
};

const Bedside: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const hospitalId = useStore((s) => s.hospitalId);
  const setHospital = useStore((s) => s.setHospital);
  const patients = useStore((s) =>
    s.patients.filter((p) => p.hospitalId === hospitalId)
  );
  const orders = useStore((s) => s.orders);
  const ackOrder = useStore((s) => s.ackOrder);
  const addNursing = useStore((s) => s.addNursing);
  const hospital = hospitalById(hospitalId);
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => patients.find((p) => p.id === patientId) || patients[0],
    [patients, patientId]
  );

  if (!hospital || !selected) {
    return (
      <div className="min-h-full">
        <Header subtitle="Bedside dashboard" back={{ to: "/", label: "Home" }} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="card">
            <div className="font-semibold mb-2">Select your hospital</div>
            <select
              className="w-full rounded-lg border border-slate-300 p-3"
              value={hospitalId}
              onChange={(e) => setHospital(e.target.value)}
            >
              {HOSPITALS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.state})
                </option>
              ))}
            </select>
          </div>
        </main>
      </div>
    );
  }

  const patientOrders = orders[selected.id] || [];

  return (
    <div className="min-h-full bg-slate-50">
      <Header
        subtitle={`${hospital.name} • ${hospital.state} • Bedside`}
        back={{ to: "/", label: "Home" }}
      />

      {/* Bed selector strip */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <div className="text-xs text-slate-500 font-medium pr-2 shrink-0">BEDS:</div>
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/bedside/${p.id}`)}
              className={clsx(
                "shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
                selected.id === p.id
                  ? "bg-navy-950 text-white border-navy-950"
                  : "bg-white text-navy-950 border-slate-200 hover:border-slate-400"
              )}
            >
              <span className={clsx("h-2 w-2 rounded-full", STATUS_COLOURS[p.status])} />
              <span>{p.bedNumber}</span>
              <span className="opacity-70">— {p.name.split(" ")[0]}</span>
            </button>
          ))}
          <div className="ml-auto shrink-0">
            <select
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={hospitalId}
              onChange={(e) => {
                setHospital(e.target.value);
                navigate("/bedside");
              }}
            >
              {HOSPITALS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Patient identity card */}
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Patient</div>
            <div className="text-2xl font-bold text-navy-950">
              {selected.name}{" "}
              <span className="text-base font-medium text-slate-500">
                {selected.age}{selected.sex}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Diagnosis</div>
            <div className="font-semibold">{selected.diagnosis}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Bed</div>
            <div className="font-semibold">{selected.bedNumber}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Admitted</div>
            <div className="font-semibold">
              {new Date(selected.admittedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </div>
          </div>
        </div>

        <StatusBanner patient={selected} />

        {/* Orders from control room */}
        {patientOrders.length > 0 && (
          <div className="card border-navy-700 border-2">
            <div className="font-semibold text-navy-950 mb-2">Orders from Control Room</div>
            <ul className="space-y-2">
              {patientOrders
                .slice()
                .reverse()
                .map((o) => (
                  <li
                    key={o.id}
                    className={clsx(
                      "flex items-start justify-between gap-3 rounded-lg p-3",
                      o.acknowledged ? "bg-slate-50" : "bg-amber-50 border border-amber-200"
                    )}
                  >
                    <div>
                      <div className="text-xs text-slate-500">
                        {new Date(o.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {o.by}
                      </div>
                      <div className="font-semibold text-navy-950">{o.text}</div>
                    </div>
                    {!o.acknowledged ? (
                      <button
                        onClick={() => ackOrder(selected.id, o.id)}
                        className="btn-primary !py-2 !px-3 text-sm shrink-0"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="pill bg-status-green text-white">Acknowledged</span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <VitalsGrid patient={selected} large />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VentilatorPanel patient={selected} />
          <LabsPanel patient={selected} />
          <MedicationsPanel patient={selected} />
          <div className="space-y-4">
            <NursingPanel patient={selected} />
            <div className="card">
              <div className="font-semibold text-navy-950 mb-2">Add nursing note</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  value={note}
                  placeholder="e.g. Suctioned moderate secretions"
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && note.trim()) {
                      addNursing(selected.id, note.trim());
                      setNote("");
                    }
                  }}
                />
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (note.trim()) {
                      addNursing(selected.id, note.trim());
                      setNote("");
                    }
                  }}
                >
                  Log
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Bedside;
