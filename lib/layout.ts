export type PaperId = "letter" | "a4";

export const PAPERS: Record<PaperId, { label: string; sub: string; w: number; h: number }> = {
  letter: { label: "Letter", sub: "8.5 × 11 in", w: 215.9, h: 279.4 },
  a4: { label: "A4", sub: "210 × 297 mm", w: 210, h: 297 },
};

export type Spot = { x: number; y: number }; // centro do círculo em mm

/**
 * Calcula quantos círculos cabem na folha, testando grade simples
 * e grade intercalada, e devolve a que cabe mais.
 */
export function computeLayout(pageW: number, pageH: number, d: number, margin = 8, gap = 4): Spot[] {
  const p = d + gap;
  const usableW = pageW - 2 * margin;
  const usableH = pageH - 2 * margin;
  if (usableW < d || usableH < d) return [];

  const gCols = Math.floor((usableW - d) / p) + 1;
  const gRows = Math.floor((usableH - d) / p) + 1;
  const grid: Spot[] = [];
  for (let r = 0; r < gRows; r++) for (let c = 0; c < gCols; c++) grid.push({ x: c * p, y: r * p });

  const vstep = (p * Math.sqrt(3)) / 2;
  const sRows = Math.floor((usableH - d) / vstep) + 1;
  const evenCols = Math.floor((usableW - d) / p) + 1;
  const oddCols = usableW - d - p / 2 >= 0 ? Math.floor((usableW - d - p / 2) / p) + 1 : 0;
  const stag: Spot[] = [];
  for (let r = 0; r < sRows; r++) {
    const odd = r % 2 === 1;
    const n = odd ? oddCols : evenCols;
    for (let c = 0; c < n; c++) stag.push({ x: c * p + (odd ? p / 2 : 0), y: r * vstep });
  }

  const best = stag.length > grid.length ? stag : grid;
  return center(best, pageW, pageH, d);
}

function center(spots: Spot[], pageW: number, pageH: number, d: number): Spot[] {
  if (!spots.length) return spots;
  const minX = Math.min(...spots.map((s) => s.x));
  const maxX = Math.max(...spots.map((s) => s.x));
  const minY = Math.min(...spots.map((s) => s.y));
  const maxY = Math.max(...spots.map((s) => s.y));
  const offX = (pageW - (maxX - minX + d)) / 2 + d / 2 - minX;
  const offY = (pageH - (maxY - minY + d)) / 2 + d / 2 - minY;
  return spots.map((s) => ({ x: s.x + offX, y: s.y + offY }));
}
