"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeLayout, PAPERS, type PaperId } from "@/lib/layout";
import { drawCircle, loadImage, type Slot } from "@/lib/draw";

const PRESETS = [
  { face: 58, cut: 70 },
  { face: 44, cut: 56 },
  { face: 32, cut: 44 },
  { face: 25, cut: 37 },
];

let uid = 0;
const emptySlot = (): Slot => ({ id: `s${++uid}`, img: null, zoom: 1, ox: 0, oy: 0, rot: 0 });
const padTo = (slots: Slot[], per: number) => {
  const target = Math.max(1, Math.ceil(slots.length / per)) * per;
  return slots.length >= target ? slots : [...slots, ...Array.from({ length: target - slots.length }, emptySlot)];
};

const ICONS = {
  plus: "M12 5v14M5 12h14",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  sheet: "M6 3h9l4 4v14H6zM14 3v5h5M12 11v6M9 14h6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  rotate: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  reset: "M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  swap: "M7 7h12l-3-3M17 17H5l3 3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  download: "M12 4v11m0 0l-4-4m4 4l4-4M5 20h14",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  close: "M6 6l12 12M18 6L6 18",
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="17" style={{ fill: "var(--pink)", stroke: "var(--edge)" }} strokeWidth="2.5" />
      <circle cx="20" cy="20" r="10" style={{ fill: "var(--sun)", stroke: "var(--edge)" }} strokeWidth="2.5" />
      <path d="M10.5 15a11 11 0 0 1 5-5.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function BadgeSheet() {
  const [paper, setPaper] = useState<PaperId>("letter");
  const [preset, setPreset] = useState(0);
  const [cutLine, setCutLine] = useState(true);
  const [showFace, setShowFace] = useState(true);
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: 8 }, emptySlot));
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pxPerMm, setPxPerMm] = useState(2);

  const sheetRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetIndex = useRef<number | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const { w: pageW, h: pageH } = PAPERS[paper];
  const { cut: cutD, face: faceD } = PRESETS[preset];
  const spots = useMemo(() => computeLayout(pageW, pageH, cutD), [pageW, pageH, cutD]);
  const per = spots.length;

  const allSlots = useMemo(() => padTo(slots, per), [slots, per]);
  const pages = allSlots.length / per;
  const currentPage = Math.min(page, pages - 1);
  const pageSlots = allSlots.slice(currentPage * per, currentPage * per + per);
  const filled = allSlots.filter((s) => s.img).length;
  const sel = allSlots.find((s) => s.id === selected) ?? null;

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPxPerMm(el.clientWidth / pageW));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW]);

  const update = useCallback((id: string, patch: Partial<Slot>) => {
    setSlots((prev) => padTo(prev, per).map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, [per]);

  const addFiles = useCallback(
    async (files: FileList | File[], startAt: number | null) => {
      setError("");
      const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      if (!list.length) return;
      const loaded: { img: HTMLImageElement; name: string }[] = [];
      for (const f of list) {
        try {
          loaded.push({ img: await loadImage(f), name: f.name });
        } catch (e) {
          setError((e as Error).message + " iPhone HEIC photos work best in Safari, or convert them to JPG first.");
        }
      }
      if (!loaded.length) return;
      let lastIndex = 0;
      setSlots((prev) => {
        const next = padTo(prev, per).slice();
        let i = startAt ?? next.findIndex((s) => !s.img);
        if (i < 0) i = next.length;
        loaded.forEach((item, n) => {
          // a primeira vai no círculo escolhido; as demais procuram círculos vazios
          if (startAt === null || n > 0) while (i < next.length && next[i].img) i++;
          while (i >= next.length) next.push(...Array.from({ length: per }, emptySlot));
          next[i] = { ...emptySlot(), img: item.img, name: item.name };
          lastIndex = i;
          i++;
        });
        return next;
      });
      setPage(Math.floor(lastIndex / per));
    },
    [per]
  );

  // Arrastar com um dedo/mouse e pinça com dois dedos. Fica na folha (e não no círculo)
  // para o segundo dedo da pinça poder cair fora do círculo, que é pequeno no celular.
  const restartGesture = (g: Gesture) => {
    const slot = allSlots.find((s) => s.id === g.slotId);
    if (slot) g.base = gestureBase(slot, g.pts);
  };

  const onSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    let g = gesture.current;
    // tocar no papel em branco tira a seleção (decidido aqui porque, com a captura do ponteiro,
    // o "click" seguinte sempre cai na folha)
    if (!g && e.target === e.currentTarget) setSelected(null);
    if (!g) {
      // o círculo é identificado pela posição na folha (igual no servidor e no cliente)
      const index = (e.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index;
      const slot = index === undefined ? undefined : pageSlots[Number(index)];
      if (!slot?.img) return;
      setSelected(slot.id);
      g = gesture.current = { slotId: slot.id, pts: new Map(), base: gestureBase(slot, new Map()) };
    }
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    restartGesture(g);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g?.pts.has(e.pointerId)) return;
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { cx, cy, dist } = measure(g.pts);
    const size = cutD * pxPerMm;
    const patch: Partial<Slot> = { ox: g.base.ox + (cx - g.base.cx) / size, oy: g.base.oy + (cy - g.base.cy) / size };
    if (g.pts.size >= 2 && g.base.dist > 0) patch.zoom = Math.min(4, Math.max(1, (g.base.zoom * dist) / g.base.dist));
    update(g.slotId, patch);
  };

  // No celular o painel do pin selecionado cobre a parte de baixo da tela:
  // ao soltar o dedo, rola a página para o pin ficar visível acima dele
  const revealSelected = (slotId: string) => {
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(".sel-card.is-open");
      const index = pageSlots.findIndex((s) => s.id === slotId);
      const pin = sheetRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (!panel || !pin || getComputedStyle(panel).position !== "fixed") return;
      // a margem faz o scrollIntoView parar acima do painel; offsetHeight (e não o retângulo)
      // porque o painel pode estar no meio da animação de entrada
      pin.style.scrollMarginBottom = `${panel.offsetHeight + 12}px`;
      pin.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  const onSheetPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g?.pts.delete(e.pointerId)) return;
    if (g.pts.size === 0) {
      gesture.current = null;
      revealSelected(g.slotId);
    } else restartGesture(g);
  };

  const openPicker = (index: number | null) => {
    targetIndex.current = index;
    fileRef.current?.click();
  };

  const fillEmpty = () => {
    if (!sel?.img) return;
    setSlots((prev) => padTo(prev, per).map((s) => (s.img ? s : { ...sel, id: emptySlot().id })));
  };

  const removeSel = () => {
    if (!sel) return;
    update(sel.id, { img: null, name: undefined, zoom: 1, ox: 0, oy: 0, rot: 0 });
  };

  const addPage = () => {
    setSlots((prev) => [...padTo(prev, per), ...Array.from({ length: per }, emptySlot)]);
    setPage(pages);
  };

  const removePage = () => {
    if (pages <= 1) return;
    setSlots((prev) => {
      const p = padTo(prev, per);
      return [...p.slice(0, currentPage * per), ...p.slice(currentPage * per + per)];
    });
    setPage(Math.max(0, currentPage - 1));
  };

  const makePdf = async () => {
    setBusy(true);
    try {
      const { buildPdf, PDF_NAME } = await import("@/lib/pdf");
      const doc = await buildPdf({ pageW, pageH, cutD, spots, slots: allSlots, cutLine });
      doc.save(PDF_NAME);
    } catch (e) {
      setError("Couldn't create the PDF: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`app${sel?.img ? " sel-open" : ""}`}>
      <header className="top">
        <div className="brand">
          <Logo />
          <span>pin sheet</span>
        </div>
        <span className="pill">
          <Icon name="lock" /> 100% on your device
        </span>
      </header>

      <section className="hero">
        <div>
          <h1>
            Make your own <mark>pins</mark>
          </h1>
          <p className="lede">
            Drop in your pics, drag them into place, and print a sheet that&apos;s ready to cut at the exact size.
          </p>
        </div>
        <button className="btn primary big" onClick={() => openPicker(null)}>
          <Icon name="plus" /> Add images
        </button>
      </section>

      <ol className="steps">
        <li className={filled ? "done" : "now"}><b>1</b> Add pics</li>
        <li className={filled ? "now" : ""}><b>2</b> Move &amp; zoom</li>
        <li><b>3</b> Print &amp; cut</li>
      </ol>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files, targetIndex.current);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="error" role="alert">
          <span>{error}</span>
          <button className="btn icon ghost" onClick={() => setError("")} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </div>
      )}

      <main className="work">
        <section className="stage" aria-label="Sheet preview">
          <div className="toolbar">
            <div className="pager">
              <button className="btn icon" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous sheet">
                <Icon name="left" />
              </button>
              <span>
                Sheet {currentPage + 1} of {pages}
              </span>
              <button className="btn icon" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pages - 1} aria-label="Next sheet">
                <Icon name="right" />
              </button>
            </div>
            <div className="tools">
              <button className="btn" onClick={addPage}><Icon name="sheet" /> New sheet</button>
              {pages > 1 && (
                <button className="btn danger" onClick={removePage}><Icon name="trash" /> Delete sheet</button>
              )}
            </div>
          </div>

          <div className="mat">
            <div
              ref={sheetRef}
              className="sheet"
              style={{ aspectRatio: `${pageW} / ${pageH}` }}
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerEnd}
              onPointerCancel={onSheetPointerEnd}
            >
              {pageSlots.map((slot, i) => (
                <Circle
                  key={slot.id}
                  index={i}
                  slot={slot}
                  spot={spots[i]}
                  pageW={pageW}
                  pageH={pageH}
                  cutD={cutD}
                  faceRatio={faceD / cutD}
                  pxPerMm={pxPerMm}
                  showFace={showFace}
                  selected={slot.id === selected}
                  onSelect={() => setSelected(slot.id)}
                  onPick={() => openPicker(currentPage * per + i)}
                  onDropFiles={(files) => addFiles(files, currentPage * per + i)}
                  onChange={(patch) => update(slot.id, patch)}
                />
              ))}
            </div>
          </div>
          <ul className="hints">
            <li>Drag to move</li>
            <li>Pinch or scroll to zoom</li>
            <li>Dark ring = folds behind the pin</li>
          </ul>
        </section>

        <aside className="panel">
          <div className={`card sel-card${sel?.img ? " is-open" : ""}`}>
            <h2>
              <i style={{ background: "var(--pink)" }} /> Selected pin
              {sel?.img && (
                <button className="btn sel-close" onClick={() => setSelected(null)}>Done</button>
              )}
            </h2>
            {sel?.img ? (
              <>
                <div className="sel-head">
                  <PinPreview slot={sel} />
                  <p className="filename" title={sel.name}>{sel.name}</p>
                </div>
                <label className="field">
                  <span className="label">
                    Zoom <em>{sel.zoom.toFixed(1)}×</em>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.01}
                    value={sel.zoom}
                    style={{ "--p": `${((sel.zoom - 1) / 3) * 100}%` } as React.CSSProperties}
                    onChange={(e) => update(sel.id, { zoom: Number(e.target.value) })}
                  />
                </label>
                <div className="row tool-grid">
                  <button className="btn tool" onClick={() => update(sel.id, { rot: (sel.rot + 90) % 360 })}><Icon name="rotate" /> Rotate</button>
                  <button className="btn tool" onClick={() => update(sel.id, { zoom: 1, ox: 0, oy: 0 })}><Icon name="reset" /> Reset</button>
                  <button className="btn tool" onClick={() => openPicker(allSlots.findIndex((s) => s.id === sel.id))}><Icon name="swap" /> Replace</button>
                  <button className="btn tool danger" onClick={removeSel}><Icon name="trash" /> Remove</button>
                </div>
                <button className="btn lime wide" onClick={fillEmpty}><Icon name="copy" /> Fill empty circles with this</button>
              </>
            ) : (
              <div className="empty">
                <span className="ghost-pin" aria-hidden />
                <p className="muted">Tap a pin to tweak it, or tap an empty circle to add a pic.</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2><i style={{ background: "var(--sky)" }} /> Sheet</h2>
            <div className="field">
              <span className="label">Paper</span>
              <div className="seg" role="radiogroup" aria-label="Paper">
                {Object.entries(PAPERS).map(([id, p]) => (
                  <label key={id}>
                    <input type="radio" name="paper" checked={paper === id} onChange={() => setPaper(id as PaperId)} />
                    <span>{p.label}<small>{p.sub}</small></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="label">Pin size</span>
              <div className="seg" role="radiogroup" aria-label="Pin size">
                {PRESETS.map((p, i) => (
                  <label key={p.face}>
                    <input type="radio" name="preset" checked={preset === i} onChange={() => setPreset(i)} />
                    <span>{p.face} mm<small>cut {p.cut}</small></span>
                  </label>
                ))}
              </div>
            </div>
            <label className="switch">
              Print cut lines
              <input type="checkbox" role="switch" checked={cutLine} onChange={(e) => setCutLine(e.target.checked)} />
            </label>
            <label className="switch">
              Show fold area <small>(not printed)</small>
              <input type="checkbox" role="switch" checked={showFace} onChange={(e) => setShowFace(e.target.checked)} />
            </label>
            <div className="stats">
              <span className="tag">{per} per sheet</span>
              <span className="tag lime">{filled} added</span>
            </div>
          </div>

          <div className="card cta">
            <button className="btn primary wide big" onClick={makePdf} disabled={busy || filled === 0}>
              <Icon name="download" /> {busy ? "Making your PDF…" : "Download PDF"}
            </button>
            <p className="small">
              When printing, pick <strong>Actual size</strong> or <strong>100%</strong>, never “Fit to page”. Check with a ruler: each circle should be {cutD} mm.
            </p>
          </div>
        </aside>
      </main>

      <footer className="foot">Your images stay on your device. Nothing gets uploaded.</footer>
    </div>
  );
}

type Point = { x: number; y: number };
type Gesture = {
  slotId: string;
  pts: Map<number, Point>;
  base: { ox: number; oy: number; zoom: number; cx: number; cy: number; dist: number };
};

function measure(pts: Map<number, Point>) {
  const list = [...pts.values()];
  if (!list.length) return { cx: 0, cy: 0, dist: 0 };
  const cx = list.reduce((a, p) => a + p.x, 0) / list.length;
  const cy = list.reduce((a, p) => a + p.y, 0) / list.length;
  const dist = list.length >= 2 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0;
  return { cx, cy, dist };
}

const gestureBase = (slot: Slot, pts: Map<number, Point>) => ({ ox: slot.ox, oy: slot.oy, zoom: slot.zoom, ...measure(pts) });

function PinPreview({ slot }: { slot: Slot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const size = 160;
    c.width = size;
    c.height = size;
    drawCircle(c.getContext("2d")!, slot, size);
  }, [slot]);
  return <canvas ref={ref} className="preview" aria-hidden />;
}

type CircleProps = {
  slot: Slot;
  index: number;
  spot: { x: number; y: number };
  pageW: number;
  pageH: number;
  cutD: number;
  faceRatio: number;
  pxPerMm: number;
  showFace: boolean;
  selected: boolean;
  onSelect: () => void;
  onPick: () => void;
  onDropFiles: (files: FileList) => void;
  onChange: (patch: Partial<Slot>) => void;
};

function Circle(p: CircleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const sizeCss = p.cutD * p.pxPerMm;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = Math.max(1, Math.round(sizeCss * dpr));
    if (c.width !== size) {
      c.width = size;
      c.height = size;
    }
    drawCircle(c.getContext("2d")!, p.slot, size);
  }, [p.slot, sizeCss]);

  // Zoom com a roda do mouse (listener não passivo para não rolar a página)
  const latest = useRef(p);
  latest.current = p;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { slot, onChange, onSelect } = latest.current;
      if (!slot.img) return;
      e.preventDefault();
      onSelect();
      const zoom = Math.min(4, Math.max(1, slot.zoom * Math.exp(-e.deltaY * 0.0015)));
      onChange({ zoom });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const style = {
    left: `${((p.spot.x - p.cutD / 2) / p.pageW) * 100}%`,
    top: `${((p.spot.y - p.cutD / 2) / p.pageH) * 100}%`,
    width: `${(p.cutD / p.pageW) * 100}%`,
    "--face": `${p.faceRatio * 100}%`,
  } as React.CSSProperties;

  return (
    <div
      ref={wrapRef}
      className={`circle${p.selected ? " is-selected" : ""}${p.slot.img ? " has-img" : ""}${over ? " is-over" : ""}`}
      style={style}
      data-index={p.index}
      role="button"
      tabIndex={0}
      aria-label={p.slot.img ? `Image ${p.slot.name ?? ""}, select to adjust` : "Empty circle, choose an image"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          p.slot.img ? p.onSelect() : p.onPick();
        }
      }}
      onClick={() => !p.slot.img && p.onPick()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) p.onDropFiles(e.dataTransfer.files);
      }}
    >
      <canvas ref={canvasRef} />
      {p.showFace && p.slot.img && <span className="fold" aria-hidden />}
      {!p.slot.img && (
        <span className="plus" aria-hidden>
          <Icon name="plus" />
        </span>
      )}
    </div>
  );
}
