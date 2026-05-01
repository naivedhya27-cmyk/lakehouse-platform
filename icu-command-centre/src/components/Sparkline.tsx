import React from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

interface Props {
  data: number[];
  colour?: string;
  height?: number;
}

const Sparkline: React.FC<Props> = ({ data, colour = "#1e3a66", height = 40 }) => {
  const points = data.map((v, i) => ({ i, v }));
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = Math.max(1, (max - min) * 0.15);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={[min - pad, max + pad]} />
        <Line type="monotone" dataKey="v" stroke={colour} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default Sparkline;
