import { CROSSHAIR, DOT, badgeRows, rects } from "@/lib/pixel-art";
function Pin({
  x,
  y,
  fill,
  glyph,
  glyphColor = "#060d22",
}: {
  x: number;
  y: number;
  fill: string;
  glyph: string[];
  glyphColor?: string;
}) {
  const art = rects(badgeRows(glyph), {
    o: "#060d22",
    f: fill,
    g: glyphColor,
  });
  return (
    <g transform={`translate(${x} ${y}) scale(3)`}>
      {art.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </g>
  );
}
// Deterministic block layout so server and client render the same map.
function blocks() {
  let seed = 7;
  const next = () =>
    (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const colsX = [20, 150, 290];
  const rowsY = [14, 124, 254];
  for (const cx of colsX)
    for (const ry of rowsY) {
      const w = cx === 150 ? 110 : 100;
      for (let i = 0; i < 3; i++) {
        const bw = 20 + Math.floor(next() * 3) * 10 + 10;
        const bh = 20 + Math.floor(next() * 3) * 10 + 10;
        const bx = cx + Math.floor(next() * ((w - bw) / 10)) * 10;
        const by = ry + i * 34 + Math.floor(next() * 2) * 10;
        if (by + bh < ry + 100) out.push({ x: bx, y: by, w: bw, h: bh });
      }
    }
  return out;
}
export default function CampusArt() {
  const b = blocks();
  return (
    <svg
      className="campus-art"
      viewBox="0 0 400 360"
      shapeRendering="crispEdges"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="360" fill="#0b1636" />
      <rect x="0" y="0" width="400" height="360" fill="#12285a" />
      {/* roads */}
      <g fill="#1b3a7a">
        <rect x="120" y="0" width="20" height="360" />
        <rect x="260" y="0" width="20" height="360" />
        <rect x="0" y="100" width="400" height="20" />
        <rect x="0" y="230" width="400" height="20" />
      </g>
      <g fill="#3a6bc4">
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={`v${i}`} x="129" y={i * 20 + 4} width="2" height="10" />
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={`w${i}`} x="269" y={i * 20 + 4} width="2" height="10" />
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <rect key={`h${i}`} x={i * 20 + 4} y="109" width="10" height="2" />
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <rect key={`i${i}`} x={i * 20 + 4} y="239" width="10" height="2" />
        ))}
      </g>
      {/* quad (park) and pond */}
      <rect x="150" y="124" width="100" height="96" fill="#1f6b49" />
      <rect x="150" y="124" width="100" height="4" fill="#2f9468" />
      <g fill="#175238">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={160 + (i % 3) * 30}
            y={140 + Math.floor(i / 3) * 40}
            width="10"
            height="10"
          />
        ))}
      </g>
      <rect x="300" y="262" width="70" height="50" fill="#08112e" />
      <rect x="300" y="262" width="70" height="4" fill="#1b3a7a" />
      {/* buildings */}
      {b.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#1d4290" />
          <rect x={r.x} y={r.y} width={r.w} height="4" fill="#4a86e0" />
          <rect
            x={r.x}
            y={r.y + r.h - 4}
            width={r.w}
            height="4"
            fill="#0f2a63"
          />
        </g>
      ))}
      {/* safe zone: current ring and next ring */}
      <circle
        cx="200"
        cy="172"
        r="136"
        fill="#7fe7ff"
        fillOpacity=".07"
        stroke="#7fe7ff"
        strokeWidth="4"
      />
      <circle
        cx="200"
        cy="172"
        r="84"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".7"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
      <g
        fill="#7fa8ec"
        fontFamily="var(--font-label), monospace"
        fontSize="9"
        letterSpacing="1"
      >
        <text x="168" y="214">
          THE QUAD
        </text>
        <text x="34" y="108">
          UNIVERSITY PL
        </text>
        <text x="284" y="258">
          POND
        </text>
      </g>
      {/* players */}
      <Pin x={226} y={118} fill="#e23c3c" glyph={CROSSHAIR} glyphColor="#fff" />
      <Pin x={118} y={196} fill="#3fbf5f" glyph={DOT} glyphColor="#060d22" />
      <Pin x={258} y={200} fill="#3fbf5f" glyph={DOT} glyphColor="#060d22" />
      <Pin x={186} y={150} fill="#ffffff" glyph={DOT} glyphColor="#2d86c4" />
    </svg>
  );
}
