import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Patient } from "../types";

interface Props {
  patient: Patient;
  variant?: "bedside" | "compact";
}

const STATUS = {
  green: { label: "GREEN — Stable", bg: "bg-status-green", text: "text-white" },
  amber: { label: "AMBER — Attention needed", bg: "bg-status-amber", text: "text-white" },
  red: { label: "RED — CRITICAL", bg: "bg-status-red", text: "text-white" }
} as const;

const StatusBanner: React.FC<Props> = ({ patient, variant = "bedside" }) => {
  const s = STATUS[patient.status];
  const isRed = patient.status === "red";
  const isAmber = patient.status === "amber";

  return (
    <div
      className={clsx(
        "rounded-xl px-5 py-4",
        s.bg,
        s.text,
        isRed && "pulse-red",
        variant === "bedside" ? "" : "px-4 py-3"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide opacity-90 font-semibold">{s.label}</div>
          <div className={clsx("font-semibold", variant === "bedside" ? "text-2xl mt-1" : "text-base mt-0.5")}>
            {patient.statusReason}
          </div>
          {patient.recommendation && (
            <div className={clsx("opacity-95", variant === "bedside" ? "mt-2 text-base" : "mt-1 text-sm")}>
              <span className="font-semibold">AI recommendation: </span>
              {patient.recommendation}
            </div>
          )}
        </div>
        {isRed && variant === "bedside" && <ControlRoomCountdown sinceIso={patient.redAlertedAt} />}
        {isAmber && variant === "bedside" && (
          <div className="text-right">
            <div className="text-xs uppercase opacity-90 font-semibold">AI alert</div>
            <div className="text-sm">Bedside review</div>
          </div>
        )}
      </div>
    </div>
  );
};

const ControlRoomCountdown: React.FC<{ sinceIso?: string }> = ({ sinceIso }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!sinceIso) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="text-right shrink-0">
      <div className="text-xs uppercase opacity-90 font-semibold">Control room alerted</div>
      <div className="text-2xl font-mono font-bold tabular-nums">
        {mm}:{ss}
      </div>
      <div className="text-xs opacity-90">since escalation</div>
    </div>
  );
};

export default StatusBanner;
