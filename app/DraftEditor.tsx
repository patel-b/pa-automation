"use client";

import { useEffect, useRef, useState } from "react";

export interface Annotation {
  id: string;
  page: number;
  xFrac: number; // 0..1 from left
  yFrac: number; // 0..1 from top
  type: "text" | "x";
  text: string;
  sizePt: number;
}

const TEXT_PT = 11;
const X_PT = 13;

/**
 * Renders the draft PDF to <canvas> (pdf.js) with an editing overlay on top:
 * add text boxes / X marks, drag to position, double-click text to edit,
 * delete. Annotations are tracked as fractional page coordinates so they can
 * be baked into the real PDF server-side on download.
 */
export default function DraftEditor({
  pdfUrl,
  annotations,
  setAnnotations,
}: {
  pdfUrl: string;
  annotations: Annotation[];
  setAnnotations: (next: Annotation[]) => void;
}) {
  const [pages, setPages] = useState<{ wPt: number; hPt: number }[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [scale, setScale] = useState(1.3); // displayed px per PDF point
  const [editingId, setEditingId] = useState<string | null>(null);

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any>(null);
  const drag = useRef<string | null>(null); // id of the annotation being dragged

  // Load the PDF and read page sizes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const data = await (await fetch(pdfUrl)).arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjs.getDocument({ data }).promise;
        docRef.current = doc;
        const dims: { wPt: number; hPt: number }[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
          dims.push({ wPt: vp.width, hPt: vp.height });
        }
        if (cancelled) return;
        setPages(dims);
        setStatus("ready");
      } catch (err) {
        console.error("DraftEditor render failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Paint each page onto its canvas once the refs exist.
  useEffect(() => {
    if (status !== "ready" || !docRef.current) return;
    let cancelled = false;
    (async () => {
      const doc = docRef.current;
      const dpr = window.devicePixelRatio || 1;
      const renderScale = 1.5;
      for (let n = 1; n <= doc.numPages; n++) {
        const canvas = canvasRefs.current[n - 1];
        if (!canvas) continue;
        const page = await doc.getPage(n);
        if (cancelled) return;
        const vp = page.getViewport({ scale: renderScale });
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        ctx.scale(dpr, dpr);
        await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Keep the overlay font size matched to the displayed page size.
  useEffect(() => {
    const el = colRef.current;
    if (!el || pages.length === 0) return;
    const update = () => setScale(el.clientWidth / pages[0].wPt);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pages]);

  const addAnnotation = (type: "text" | "x") =>
    setAnnotations([
      ...annotations,
      {
        id: Math.random().toString(36).slice(2),
        page: 0,
        xFrac: 0.42,
        yFrac: 0.08,
        type,
        text: type === "x" ? "X" : "New text",
        sizePt: type === "x" ? X_PT : TEXT_PT,
      },
    ]);

  const update = (id: string, patch: Partial<Annotation>) =>
    setAnnotations(annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) =>
    setAnnotations(annotations.filter((a) => a.id !== id));

  const onPointerMove = (e: React.PointerEvent, pageIdx: number) => {
    if (!drag.current) return;
    const rect = pageRefs.current[pageIdx]?.getBoundingClientRect();
    if (!rect) return;
    const xFrac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const yFrac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    update(drag.current, { xFrac, yFrac, page: pageIdx });
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
        <span className="text-xs font-medium text-gray-500">Manual edits:</span>
        <button
          onClick={() => addAnnotation("text")}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-[#e0006d] hover:text-[#e0006d]"
        >
          + Add text
        </button>
        <button
          onClick={() => addAnnotation("x")}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-[#e0006d] hover:text-[#e0006d]"
        >
          + Add ✕
        </button>
        <span className="text-[11px] text-gray-400">
          Drag to position · double-click text to edit · hover to delete
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {status === "loading" && (
          <p className="py-8 text-center text-sm text-gray-500">Rendering the form…</p>
        )}
        {status === "error" && (
          <p className="py-8 text-center text-sm text-gray-600">
            Couldn&apos;t render the preview here — use “Download PDF” below.
          </p>
        )}
        <div ref={colRef} className="mx-auto max-w-3xl">
          {pages.map((pg, idx) => (
            <div
              key={idx}
              ref={(el) => {
                pageRefs.current[idx] = el;
              }}
              className="relative mb-4"
              style={{ aspectRatio: `${pg.wPt} / ${pg.hPt}` }}
              onPointerMove={(e) => onPointerMove(e, idx)}
              onPointerUp={() => (drag.current = null)}
              onPointerLeave={() => (drag.current = null)}
            >
              <canvas
                ref={(el) => {
                  canvasRefs.current[idx] = el;
                }}
                className="block w-full rounded border border-gray-200 bg-white shadow-sm"
              />
              {/* Annotation overlay for this page */}
              {annotations
                .filter((a) => a.page === idx)
                .map((a) => (
                  <div
                    key={a.id}
                    className="group absolute"
                    style={{ left: `${a.xFrac * 100}%`, top: `${a.yFrac * 100}%` }}
                  >
                    {/* drag + delete controls (not baked into the PDF) */}
                    <div className="absolute -top-4 left-0 flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <span
                        title="Drag"
                        onPointerDown={(e) => {
                          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                          drag.current = a.id;
                        }}
                        className="cursor-move select-none rounded bg-gray-700 px-1 text-[10px] leading-4 text-white"
                      >
                        ✥
                      </span>
                      <button
                        onClick={() => remove(a.id)}
                        title="Delete"
                        className="rounded bg-red-600 px-1 text-[10px] leading-4 text-white"
                      >
                        ×
                      </button>
                    </div>
                    {editingId === a.id && a.type === "text" ? (
                      <input
                        autoFocus
                        defaultValue={a.text}
                        onBlur={(e) => {
                          update(a.id, { text: e.target.value });
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        style={{ fontSize: a.sizePt * scale }}
                        className="border border-[#e0006d] bg-white px-0.5 text-blue-800 outline-none"
                      />
                    ) : (
                      <span
                        onPointerDown={(e) => {
                          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                          drag.current = a.id;
                        }}
                        onDoubleClick={() =>
                          a.type === "text" && setEditingId(a.id)
                        }
                        style={{ fontSize: a.sizePt * scale }}
                        className={`block cursor-move select-none whitespace-pre leading-none text-blue-800 ${
                          a.type === "x" ? "font-bold" : ""
                        }`}
                      >
                        {a.text}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
