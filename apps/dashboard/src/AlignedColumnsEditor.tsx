import { useMemo, useRef, useState } from "react";
import {
  type AlignedColumnsConfig,
  buildGrid,
  findYear,
  isYearlessFormat,
  itemAt,
  looksLikeDateCell,
  type TextItem,
} from "statement-core";
import type { EditorProps } from "./editors.js";
import { MappingStep } from "./MappingStep.js";
import { fromFieldMapping, toFieldMapping } from "./mappingState.js";
import { type PageOverlayContext, PdfPageViewer } from "./PdfPageViewer.js";

const round = (n: number) => Math.round(n * 10) / 10;

interface DividerProps {
  index: number;
  x: number;
  scale: number;
  min: number;
  max: number;
  onMove: (x: number) => void;
  onRemove: () => void;
}

/** A draggable vertical divider; positions are in PDF points. */
function Divider({
  index,
  x,
  scale,
  min,
  max,
  onMove,
  onRemove,
}: DividerProps) {
  const dragging = useRef(false);
  const clamp = (v: number) => round(Math.max(min, Math.min(max, v)));
  const label = `Divider ${index + 1}`;
  return (
    <div
      className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-col-resize touch-none"
      style={{ left: x * scale }}
    >
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={Math.round(min)}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(x)}
        className="mx-auto h-full w-0.5 bg-error outline-offset-2 focus-visible:outline"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const box = e.currentTarget.parentElement?.parentElement;
          if (!box) return;
          onMove(clamp((e.clientX - box.getBoundingClientRect().left) / scale));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onMove(clamp(x - step));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            onMove(clamp(x + step));
          }
        }}
      />
      <button
        type="button"
        className="btn btn-error btn-xs absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full"
        aria-label={`Remove ${label.toLowerCase()}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

/** Position and size of a text item over the page, in CSS pixels. */
const boxStyle = (item: TextItem, ctx: PageOverlayContext) => ({
  left: item.x * ctx.scale,
  top: (ctx.height - item.y - item.height) * ctx.scale,
  width: Math.max(item.width, 1) * ctx.scale,
  height: Math.max(item.height, 1) * ctx.scale,
});

/**
 * Setup for the "Aligned columns" approach: place dividers over the page, then
 * map the resulting columns to transaction fields.
 */
export function AlignedColumnsEditor({
  doc,
  config: raw,
  onChange,
}: EditorProps) {
  const config = raw as AlignedColumnsConfig;
  const { pages } = doc;
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.4);
  const [pickingYear, setPickingYear] = useState(false);
  const [yearMessage, setYearMessage] = useState("");

  const update = (patch: Partial<AlignedColumnsConfig>) =>
    onChange({ ...config, ...patch });
  const dividers = config.dividers;
  const mappingState = useMemo(
    () => fromFieldMapping(config.mapping),
    [config.mapping],
  );
  const yearless = isYearlessFormat(config.mapping.dateFormat);
  const anchor = config.yearAnchor;
  const anchorItem = anchor ? itemAt(pages, anchor) : undefined;
  const anchorYear = anchorItem ? findYear(anchorItem.text) : null;
  const picking = yearless && (pickingYear || !anchor);

  const grid = useMemo(() => buildGrid(pages, dividers), [pages, dividers]);
  const rows = useMemo(() => {
    const col = config.mapping.dateColumn;
    const dated = (cells: string[], c: number) =>
      looksLikeDateCell(cells[c] ?? "");
    const byColumn =
      Number.isInteger(col) && col >= 0
        ? grid.filter((g) => dated(g.cells, col))
        : [];
    const found =
      byColumn.length > 0
        ? byColumn
        : grid.filter((g) => g.cells.some((_, c) => dated(g.cells, c)));
    return found.map((g) => g.cells);
  }, [grid, config.mapping.dateColumn]);

  const move = (i: number, x: number) =>
    update({ dividers: dividers.map((d, j) => (j === i ? x : d)) });
  const remove = (i: number) =>
    update({ dividers: dividers.filter((_, j) => j !== i) });
  const insert = (x: number) =>
    update({ dividers: [...dividers, round(x)].sort((a, b) => a - b) });

  /** A new divider goes in the middle of the widest stretch without one. */
  function addDivider() {
    const width = pages[page - 1]?.width ?? 600;
    const edges = [0, ...dividers, width];
    let best = 0;
    for (let i = 1; i < edges.length; i++) {
      const gap = (edges[i] ?? 0) - (edges[i - 1] ?? 0);
      if (gap > (edges[best + 1] ?? 0) - (edges[best] ?? 0)) best = i - 1;
    }
    insert(((edges[best] ?? 0) + (edges[best + 1] ?? width)) / 2);
  }

  function chooseYear(item: TextItem) {
    if (findYear(item.text) === null) {
      setYearMessage(
        `"${item.text}" has no year. Click text that contains a year.`,
      );
      return;
    }
    setYearMessage("");
    setPickingYear(false);
    update({
      yearAnchor: {
        page,
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
      },
    });
  }

  const pageItems = pages[page - 1]?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm opacity-70">
        Place the dividers between the columns of the table. They apply to every
        page. Drag a divider (or focus it and use the arrow keys), double-click
        the page to add one, or remove one to merge two columns. Only lines that
        begin with a date become transactions.
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-sm" onClick={addDivider}>
          Add divider
        </button>
        <span className="text-sm opacity-70">
          {dividers.length} divider{dividers.length === 1 ? "" : "s"}
        </span>
      </div>

      <PdfPageViewer
        doc={doc}
        page={page}
        onPageChange={setPage}
        zoom={zoom}
        onZoomChange={setZoom}
        overlay={(ctx) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: double-click is a shortcut; "Add divider" is the accessible way
          <div
            className="absolute inset-0"
            onDoubleClick={(e) => {
              if (e.target !== e.currentTarget) return;
              insert(
                (e.clientX - e.currentTarget.getBoundingClientRect().left) /
                  ctx.scale,
              );
            }}
          >
            {anchor && anchor.page === ctx.page && anchorItem ? (
              <div
                data-testid="year-highlight"
                className="pointer-events-none absolute rounded-sm bg-warning/40 outline outline-warning"
                style={boxStyle(anchorItem, ctx)}
              />
            ) : null}
            {picking
              ? pageItems.map((item, i) => (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: items are positional
                    key={i}
                    type="button"
                    aria-label={`Use "${item.text}" as the year`}
                    className="absolute cursor-pointer rounded-sm outline outline-info/50 hover:bg-info/30"
                    style={boxStyle(item, ctx)}
                    onClick={() => chooseYear(item)}
                  />
                ))
              : null}
            {dividers.map((x, i) => (
              <Divider
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered by position
                key={i}
                index={i}
                x={x}
                scale={ctx.scale}
                min={(dividers[i - 1] ?? 0) + 1}
                max={(dividers[i + 1] ?? ctx.width) - 1}
                onMove={(nx) => move(i, nx)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        )}
      />

      <MappingStep
        state={mappingState}
        onChange={(s) => update({ mapping: toFieldMapping(s) })}
        rows={rows}
        columnCount={dividers.length + 1}
        allowYearless
        showPreview={false}
      />

      {yearless ? (
        <fieldset className="fieldset rounded-box border border-base-300 bg-base-200 p-4">
          <legend className="fieldset-legend">Year</legend>
          {anchor && anchorYear !== null ? (
            <p>
              Year <strong>{anchorYear}</strong> from "{anchorItem?.text}" (the
              year of the last row).
            </p>
          ) : (
            <p>
              The dates have no year. Click the text on the page that contains
              the year (the year of the last row).
            </p>
          )}
          {yearMessage ? (
            <p role="alert" className="text-error">
              {yearMessage}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setYearMessage("");
                setPickingYear(!picking);
              }}
            >
              {picking && anchor
                ? "Cancel"
                : anchor
                  ? "Change year"
                  : "Choose year"}
            </button>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
