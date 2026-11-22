import type { BurnLine } from "../lib/burnin";

/** Burned-in readings (road speed, weather, nearby congestion) as OSD lines. */
export function BurnLines({ lines, className = "" }: { lines: BurnLine[]; className?: string }) {
  if (!lines.length) return null;
  return (
    <div className={`burn ${className}`}>
      {lines.map((line, i) => (
        <div className="burn-line" key={i}>
          {line.map((p, j) => (
            <span key={j} style={{ color: p.color }}>
              {p.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
