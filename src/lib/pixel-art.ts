// Tiny pixel-art toolkit: sprites are rows of characters mapped through a palette, then
// merged into horizontal runs of <rect>s so they stay crisp at any scale.
export type Rect = { x: number; y: number; w: number; h: number; fill: string };
export function rects(
  rows: string[],
  palette: Record<string, string>,
): { w: number; h: number; rects: Rect[] } {
  const w = Math.max(...rows.map((r) => r.length));
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const c = row[x] ?? ".";
      if (c === "." || !palette[c]) {
        x++;
        continue;
      }
      let end = x + 1;
      while ((row[end] ?? ".") === c) end++;
      out.push({ x, y, w: end - x, h: 1, fill: palette[c] });
      x = end;
    }
  });
  return { w, h: rows.length, rects: out };
}
export function svgMarkup(
  rows: string[],
  palette: Record<string, string>,
  px: number,
) {
  const a = rects(rows, palette);
  const body = a.rects
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${a.w * px}" height="${a.h * px}" viewBox="0 0 ${a.w} ${a.h}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}
const O = "#060d22";
export const PALETTE = {
  o: O,
  w: "#ffffff",
  s: "#ffd2a6",
  r: "#ff9a2f",
  d: "#c0600f",
  b: "#2d86c4",
  c: "#7fe7ff",
  g: "#3fbf5f",
  G: "#1f7a3a",
  R: "#e23c3c",
  Q: "#9c1f1f",
  y: "#ffd23f",
  n: "#0b1636",
};
// Original mascot: a runner in an orange hoodie and cap.
export const RUNNER = [
  "....oooo....",
  "...orrrro...",
  "..orrrrrro..",
  "..oddddddo..",
  "..osssssso..",
  "..osnssnso..",
  "..osssssso..",
  "...ossso....",
  "..orrrrro...",
  ".osorrrrros.",
  ".osorrrrrso.",
  "..orrrrro...",
  "..obbbbbo...",
  "..obo.obo...",
  "..oko.oko...",
  "..ooo.ooo...",
].map((r) => r.replace(/k/g, "w"));
export const STAR = [
  "...y...",
  "...y...",
  "yyyyyyy",
  ".yyyyy.",
  "..yyy..",
  ".yy.yy.",
  ".y...y.",
];
export const CROSSHAIR = [
  "...o...",
  "...o...",
  "..ooo..",
  "oo.o.oo",
  "..ooo..",
  "...o...",
  "...o...",
];
export const DOT = ["ooo", "ooo", "ooo"];

// 9x9 octagon badge used for map pins; glyphs are overlaid at its centre.
export const BADGE = [
  "..ooooo..",
  ".offfffo.",
  "offfffffo",
  "offfffffo",
  "offfffffo",
  "offfffffo",
  "offfffffo",
  ".offfffo.",
  "..ooooo..",
];
export function badgeRows(glyph: string[]) {
  const off = Math.floor((BADGE.length - glyph.length) / 2);
  return BADGE.map((row, y) =>
    row
      .split("")
      .map((c, x) => {
        const g = glyph[y - off]?.[x - off];
        return g && g !== "." ? "g" : c;
      })
      .join(""),
  );
}
