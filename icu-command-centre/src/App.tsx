import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Bedside from "./pages/Bedside";
import ControlRoom from "./pages/ControlRoom";
import Support from "./pages/Support";
import { useStore } from "./store";

const TICK_MS = 4000;

const App: React.FC = () => {
  const tick = useStore((s) => s.tick);
  const setOnline = useStore((s) => s.setOnline);

  useEffect(() => {
    const id = window.setInterval(() => tick(), TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOnline]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/bedside" element={<Bedside />} />
      <Route path="/bedside/:patientId" element={<Bedside />} />
      <Route path="/control-room" element={<ControlRoom />} />
      <Route path="/control-room/:hospitalId" element={<ControlRoom />} />
      <Route path="/control-room/:hospitalId/:patientId" element={<ControlRoom />} />
      <Route path="/support/*" element={<Support />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
};

export default App;
