import { jsPDF } from "jspdf";
import { drawCircle, type Slot } from "./draw";
import type { Spot } from "./layout";

type Options = {
  pageW: number;
  pageH: number;
  cutD: number;
  spots: Spot[];
  slots: Slot[];
  cutLine: boolean;
};

const DPI = 300;
export const PDF_NAME = "pins-to-print.pdf";

export async function buildPdf(o: Options) {
  const doc = new jsPDF({ unit: "mm", format: [o.pageW, o.pageH], orientation: "portrait" });
  const px = Math.round((o.cutD / 25.4) * DPI);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const per = o.spots.length;
  const pages = Math.ceil(o.slots.length / per);
  let first = true;

  for (let p = 0; p < pages; p++) {
    const pageSlots = o.slots.slice(p * per, p * per + per);
    if (!pageSlots.some((s) => s.img)) continue; // não imprime folhas vazias
    if (!first) doc.addPage([o.pageW, o.pageH], "portrait");
    first = false;

    pageSlots.forEach((slot, i) => {
      const { x, y } = o.spots[i];
      const r = o.cutD / 2;
      if (slot.img) {
        drawCircle(ctx, slot, px);
        // Recorta em círculo no próprio PDF, para os cantos do quadrado
        // não cobrirem os círculos vizinhos
        doc.saveGraphicsState();
        doc.circle(x, y, r, null);
        doc.clip();
        doc.discardPath();
        doc.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", x - r, y - r, o.cutD, o.cutD, undefined, "FAST");
        doc.restoreGraphicsState();
      }
      if (o.cutLine) {
        doc.setDrawColor(slot.img ? 70 : 190);
        doc.setLineWidth(0.15);
        doc.circle(x, y, r, "S");
      }
    });
    await new Promise((res) => setTimeout(res, 0)); // deixa a interface respirar
  }
  return doc;
}
