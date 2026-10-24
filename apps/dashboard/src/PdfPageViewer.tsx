import { type ReactNode, useEffect, useRef } from "react";
import type { PdfDocument } from "statement-pdf";

export interface PageOverlayContext {
  /** 1-based page number. */
  page: number;
  /** CSS pixels per PDF point. */
  scale: number;
  /** Page size in PDF points. */
  width: number;
  height: number;
}

export interface PdfPageViewerProps {
  doc: PdfDocument;
  /** 1-based page number. */
  page: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Drawn over the page, positioned from PDF points scaled by `scale`. */
  overlay?: (ctx: PageOverlayContext) => ReactNode;
}

const ZOOM_STEPS = [0.6, 0.8, 1, 1.2, 1.4, 1.7, 2, 2.5, 3];

/** One rendered PDF page with page navigation, zoom and an overlay layer. */
export function PdfPageViewer({
  doc,
  page,
  onPageChange,
  zoom,
  onZoomChange,
  overlay,
}: PdfPageViewerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const info = doc.pages[page - 1];

  useEffect(() => {
    let stale = false;
    // pdfjs cannot draw to one canvas twice at once, so renders are chained.
    queue.current = queue.current.then(async () => {
      const el = canvas.current;
      if (stale || !el) return;
      await doc.renderPage(page, el, zoom).catch(() => {});
    });
    return () => {
      stale = true;
    };
  }, [doc, page, zoom]);

  if (!info) return null;
  const step = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.findIndex((z) => z >= zoom - 1e-9);
    const next =
      ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))];
    if (next !== undefined) onZoomChange(next);
  };
  const width = info.width * zoom;
  const height = info.height * zoom;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous page
        </button>
        <span aria-live="polite">
          Page {page} of {doc.pages.length}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={page >= doc.pages.length}
          onClick={() => onPageChange(page + 1)}
        >
          Next page
        </button>
        <span className="ml-4 flex items-center gap-1">
          <button
            type="button"
            className="btn btn-sm"
            aria-label="Zoom out"
            onClick={() => step(-1)}
          >
            −
          </button>
          <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
          <button
            type="button"
            className="btn btn-sm"
            aria-label="Zoom in"
            onClick={() => step(1)}
          >
            +
          </button>
        </span>
      </div>
      <div className="overflow-auto rounded-box border border-base-300 bg-base-200">
        <div
          className="relative bg-white"
          style={{ width, height }}
          data-testid="page"
        >
          <canvas
            ref={canvas}
            aria-label={`Page ${page}`}
            style={{ width, height }}
          />
          <div className="absolute inset-0" data-testid="page-overlay">
            {overlay?.({
              page,
              scale: zoom,
              width: info.width,
              height: info.height,
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
