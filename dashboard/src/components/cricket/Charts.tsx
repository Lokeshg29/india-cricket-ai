"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FormatData } from "@/lib/cricket";

const COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)", "var(--chart-4)"];
const AX = { fontSize: 11, fill: "rgba(255,255,255,0.45)" };
const TT = { background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 };

export function FormChart({ form }: { form: FormatData["form"] }) {
  return (
    <div className="glass-card h-56 rounded-lg p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={form}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={AX} minTickGap={40} />
          <YAxis domain={[0, 1]} tick={AX} width={32} />
          <Tooltip contentStyle={TT} />
          <Line type="monotone" dataKey="form" name="India form (rolling)" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ trend }: { trend: FormatData["trend"] }) {
  const ids = Array.from(new Set(trend.map((t) => t.match_id)));
  const steps = Array.from(new Set(trend.map((t) => t.step))).sort((a, b) => a - b);
  const rows = steps.map((step) => {
    const row: Record<string, number> = { step };
    for (const id of ids) {
      const t = trend.find((x) => x.match_id === id && x.step === step);
      if (t) row[id] = Number((t.india * 100).toFixed(1));
    }
    return row;
  });
  return (
    <div className="glass-card h-64 rounded-lg p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="step" tick={AX} label={{ value: "model refit step", position: "insideBottom", offset: -2, ...AX }} />
          <YAxis tick={AX} width={36} unit="%" />
          <Tooltip contentStyle={TT} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {ids.map((id, i) => (
            <Line key={id} type="monotone" dataKey={id} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CalibrationChart({ calibration }: { calibration: FormatData["validation"]["calibration"] }) {
  const rows = calibration.map((c) => ({
    bin: c.bin,
    confidence: Number((c.mean_confidence * 100).toFixed(1)),
    accuracy: Number((c.accuracy * 100).toFixed(1)),
  }));
  return (
    <div className="glass-card h-56 rounded-lg p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="bin" tick={AX} />
          <YAxis domain={[0, 100]} tick={AX} width={36} unit="%" />
          <Tooltip contentStyle={TT} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="confidence" name="Mean predicted %" stroke="var(--chart-1)" strokeWidth={2} />
          <Line dataKey="accuracy" name="Observed accuracy" stroke="var(--chart-3)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
