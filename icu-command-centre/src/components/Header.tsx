import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store";
import clsx from "clsx";

interface HeaderProps {
  subtitle?: string;
  variant?: "light" | "dark";
  back?: { to: string; label: string };
}

const Header: React.FC<HeaderProps> = ({ subtitle, variant = "light", back }) => {
  const online = useStore((s) => s.online);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dark = variant === "dark";
  return (
    <header
      className={clsx(
        "flex items-center justify-between px-6 py-3 border-b",
        dark ? "bg-navy-950 border-navy-800 text-white" : "bg-white border-slate-200 text-navy-950"
      )}
    >
      <div className="flex items-center gap-4">
        {back && (
          <Link
            to={back.to}
            className={clsx(
              "text-sm font-medium opacity-80 hover:opacity-100",
              dark ? "text-slate-200" : "text-navy-800"
            )}
          >
            ← {back.label}
          </Link>
        )}
        <Link to="/" className="flex items-center gap-3">
          <div
            className={clsx(
              "h-9 w-9 rounded-lg flex items-center justify-center font-bold",
              dark ? "bg-white text-navy-950" : "bg-navy-950 text-white"
            )}
          >
            ICU
          </div>
          <div>
            <div className="text-base font-bold leading-tight">ICU Command Centre</div>
            {subtitle && (
              <div className={clsx("text-xs leading-tight", dark ? "text-slate-300" : "text-slate-500")}>
                {subtitle}
              </div>
            )}
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-5 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "h-2.5 w-2.5 rounded-full",
              online ? "bg-status-green" : "bg-status-red animate-pulse"
            )}
          />
          <span className="font-medium">{online ? "Online" : "Offline mode"}</span>
        </div>
        <div className="font-mono tabular-nums">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>
    </header>
  );
};

export default Header;
