import { PALETTE, RUNNER, rects } from "@/lib/pixel-art";
import { Fix } from "@/lib/types";
export function Sprite({
  rows,
  palette = PALETTE,
  px = 4,
  label,
}: {
  rows: string[];
  palette?: Record<string, string>;
  px?: number;
  label?: string;
}) {
  const a = rects(rows, palette);
  return (
    <svg
      className="sprite"
      width={a.w * px}
      height={a.h * px}
      viewBox={`0 0 ${a.w} ${a.h}`}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {a.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  );
}
export const Runner = ({ px = 4 }: { px?: number }) => (
  <Sprite rows={RUNNER} px={px} />
);
// Single-line LED readout. Pass status text; it is announced politely to screen readers.
export function Ticker({
  children,
  mascot = true,
  tone = "info",
}: {
  children: React.ReactNode;
  mascot?: boolean;
  tone?: "info" | "warn" | "alert" | "dim" | "good";
}) {
  return (
    <div className="ticker-row">
      {mascot && (
        <span className="mascot">
          <Runner px={4} />
        </span>
      )}
      <p className={`ticker tone-${tone}`} aria-live="polite">
        {children}
        <span className="cursor" aria-hidden="true" />
      </p>
    </div>
  );
}
function octagon(r: number) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  });
  return pts.join(" ");
}
// Zone radar: the outer ring is the current safe zone, the dashed ring is the next one.
// North is up. Dots outside the zone are pinned to the edge.
export function ZoneRadar({
  center,
  radius,
  nextRadius,
  fix,
  reveals = [],
  fallbackToCenter = false,
}: {
  center: { lat: number; lng: number };
  radius: number;
  nextRadius: number;
  fix: Pick<Fix, "lat" | "lng"> | null;
  reveals?: { lat: number; lng: number }[];
  fallbackToCenter?: boolean;
}) {
  const R = 40;
  const place = (p: { lat: number; lng: number }) => {
    const dx =
      (p.lng - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180);
    const dy = (p.lat - center.lat) * 111320;
    const k = R / Math.max(1, radius);
    let x = dx * k,
      y = -dy * k;
    const m = Math.hypot(x, y);
    if (m > R) {
      x = (x / m) * R;
      y = (y / m) * R;
    }
    return { x: 50 + Math.round(x), y: 50 + Math.round(y) };
  };
  const me = fix ? place(fix) : fallbackToCenter ? { x: 50, y: 50 } : null;
  return (
    <svg
      className="radar"
      viewBox="0 0 100 100"
      width="112"
      height="112"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Zone radar. Safe zone ${Math.round(radius)} metres, next ${Math.round(nextRadius)} metres.`}
    >
      <polygon points={octagon(46)} className="radar-bg" />
      <polygon points={octagon(R)} className="radar-ring" />
      <polygon
        points={octagon(Math.max(4, (R * nextRadius) / Math.max(1, radius)))}
        className="radar-next"
      />
      <path d="M50 8V92M8 50H92" className="radar-axis" />
      <g className="radar-sweep">
        <path d="M50 50L50 10" className="radar-beam" />
      </g>
      {reveals.map((p, i) => {
        const q = place(p);
        return (
          <rect
            key={i}
            x={q.x - 3}
            y={q.y - 3}
            width="6"
            height="6"
            className="radar-reveal"
          />
        );
      })}
      {me && (
        <rect
          x={me.x - 4}
          y={me.y - 4}
          width="8"
          height="8"
          className="radar-me"
        />
      )}
      <text x="50" y="7" className="radar-n" textAnchor="middle">
        N
      </text>
    </svg>
  );
}
