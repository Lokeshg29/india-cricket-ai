// Original, hand-built vector impression of India at night (simplified
// stylized outline, projected from lon/lat; no third-party image asset, so
// no licensing question). City lights are real city coordinates; glow and
// pulse are CSS only.
const W = 560;
const H = 640;
const px = (lon: number) => (lon - 68) * 18.6;
const py = (lat: number) => (37.2 - lat) * 20;

const OUTLINE: [number, number][] = [
  [74.0, 36.8], [75.5, 36.6], [77.5, 35.6], [79.0, 34.8], [80.3, 33.2], [79.0, 32.4], [78.8, 31.0],
  [80.2, 30.3], [81.8, 30.4], [83.0, 29.4], [84.2, 28.6], [85.7, 28.3], [87.0, 27.9], [88.1, 27.9],
  [88.8, 28.1], [88.9, 27.3], [89.6, 28.2], [91.6, 27.8], [92.0, 28.2], [94.0, 29.3], [95.2, 29.0],
  [96.2, 28.3], [97.4, 28.0], [96.0, 27.3], [95.0, 26.8], [94.7, 25.3], [94.3, 24.0], [93.4, 23.0],
  [93.1, 22.3], [92.6, 22.9], [92.3, 23.7], [91.6, 23.0], [91.3, 24.1], [92.2, 24.9], [91.5, 25.2],
  [90.2, 25.2], [89.8, 25.9], [89.0, 26.3], [88.3, 26.5], [88.2, 26.0], [88.5, 25.2], [88.1, 24.8],
  [88.6, 24.3], [88.9, 23.5], [88.7, 22.9], [89.0, 22.1], [88.7, 21.6], [87.0, 21.5], [86.8, 20.7],
  [85.9, 19.9], [84.8, 19.2], [83.4, 18.0], [82.3, 16.7], [81.2, 16.2], [80.3, 15.4], [80.1, 13.9],
  [80.3, 13.0], [79.9, 11.8], [79.8, 10.3], [78.9, 9.3], [78.1, 8.8], [77.5, 8.1], [76.5, 8.8],
  [76.2, 9.9], [75.8, 11.0], [75.0, 12.4], [74.7, 13.4], [74.1, 14.8], [73.8, 15.7], [73.4, 16.9],
  [72.8, 18.5], [72.8, 19.9], [72.7, 21.2], [72.6, 22.2], [72.2, 21.2], [71.0, 20.9], [70.1, 21.5],
  [69.0, 22.3], [70.0, 22.9], [68.7, 23.5], [68.2, 23.6], [68.8, 24.3], [70.0, 24.2], [70.8, 24.3],
  [71.0, 25.3], [70.3, 26.0], [70.0, 27.0], [70.4, 28.0], [71.9, 28.9], [72.9, 29.9], [74.0, 30.8],
  [74.8, 32.0], [75.2, 32.6], [74.6, 33.2], [73.7, 34.0], [74.0, 34.9],
];

type City = { name: string; lon: number; lat: number; major?: boolean };
export const CITIES: City[] = [
  { name: "Delhi", lon: 77.2, lat: 28.6, major: true },
  { name: "Mumbai", lon: 72.88, lat: 19.08, major: true },
  { name: "Kolkata", lon: 88.36, lat: 22.57, major: true },
  { name: "Chennai", lon: 80.27, lat: 13.08, major: true },
  { name: "Bengaluru", lon: 77.6, lat: 12.97, major: true },
  { name: "Hyderabad", lon: 78.48, lat: 17.38, major: true },
  { name: "Ahmedabad", lon: 72.57, lat: 23.03 },
  { name: "Pune", lon: 73.86, lat: 18.52 },
  { name: "Lucknow", lon: 80.95, lat: 26.85 },
  { name: "Jaipur", lon: 75.79, lat: 26.91 },
  { name: "Chandigarh", lon: 76.78, lat: 30.73 },
  { name: "Guwahati", lon: 91.74, lat: 26.14 },
  { name: "Dharamsala", lon: 76.32, lat: 32.22 },
  { name: "Nagpur", lon: 79.09, lat: 21.15 },
  { name: "Indore", lon: 75.86, lat: 22.72 },
  { name: "Ranchi", lon: 85.33, lat: 23.34 },
  { name: "Visakhapatnam", lon: 83.22, lat: 17.69 },
  { name: "Thiruvananthapuram", lon: 76.95, lat: 8.52 },
];

const path = OUTLINE.map(([lo, la], i) => `${i ? "L" : "M"}${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join(" ") + " Z";
const hyd = CITIES[5];
const trails = CITIES.filter((c) => ["Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru"].includes(c.name));

export default function IndiaNightMap({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`} aria-hidden="true">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={compact ? "h-[min(55vh,480px)] w-auto max-w-full opacity-65" : "h-[min(86vh,760px)] w-auto max-w-[96vw] opacity-90"}
      >
        <defs>
          <radialGradient id="ica-land" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#14264a" />
            <stop offset="100%" stopColor="#0a1220" />
          </radialGradient>
          <radialGradient id="ica-glow">
            <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#ff9933" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ff9933" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ica-glow-blue">
            <stop offset="0%" stopColor="#bfe0ff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#4b9bff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4b9bff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={path} fill="url(#ica-land)" stroke="#4b9bff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#4b9bff" strokeOpacity="0.18" strokeWidth="6" strokeLinejoin="round" />
        {trails.map((c) => (
          <path
            key={c.name}
            d={`M${px(hyd.lon)} ${py(hyd.lat)} Q${(px(hyd.lon) + px(c.lon)) / 2} ${Math.min(py(hyd.lat), py(c.lat)) - 40} ${px(c.lon)} ${py(c.lat)}`}
            fill="none"
            stroke="#f26b78"
            strokeOpacity="0.18"
            strokeWidth="0.8"
            strokeDasharray="4 8"
            style={{ animation: "wc-dash 12s linear infinite" }}
          />
        ))}
        {CITIES.map((c, i) => {
          const r = c.major ? 15 : 9;
          return (
            <g key={c.name} style={{ animation: `ica-twinkle ${2.4 + (i % 5) * 0.5}s ease-in-out ${(i % 7) * 0.3}s infinite` }}>
              <circle cx={px(c.lon)} cy={py(c.lat)} r={r} fill={c.name === "Hyderabad" ? "url(#ica-glow-blue)" : "url(#ica-glow)"} />
              <circle cx={px(c.lon)} cy={py(c.lat)} r={c.major ? 2.4 : 1.6} fill="#fff4e0" />
            </g>
          );
        })}
        {/* Andaman & Nicobar, stylised */}
        {[[92.7, 12.0], [92.9, 11.2], [93.0, 10.4], [93.6, 8.0]].map(([lo, la]) => (
          <circle key={`${lo}-${la}`} cx={px(lo)} cy={py(la)} r="2.2" fill="#14264a" stroke="#4b9bff" strokeOpacity="0.4" />
        ))}
      </svg>
    </div>
  );
}
