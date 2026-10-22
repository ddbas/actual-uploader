import { guessMapping } from "../guess.js";
import {
  DATE_FORMATS,
  type DateFormat,
  detectDateFormats,
  detectYearlessFormats,
  type FieldMapping,
  isIndex,
  isYearlessFormat,
  type MonthDay,
  mapRow,
  parseDate,
  parseMonthDay,
  type RowError,
  resolveYears,
  validateMapping,
  type YearlessDateFormat,
} from "../mapping.js";
import type { Transaction } from "../transaction.js";
import type {
  Approach,
  ApproachResult,
  PdfPageItems,
  TextItem,
} from "./types.js";

/** Where the user clicked to say which text contains the statement's year. */
export interface YearAnchor {
  /** 1-based page number. */
  page: number;
  /** A point inside the text, in PDF points. */
  x: number;
  y: number;
}

export interface AlignedColumnsConfig {
  version: 1;
  /** Vertical dividers as x positions in PDF points, shared by all pages. */
  dividers: number[];
  mapping: FieldMapping;
  /** Required when the date format has no year. */
  yearAnchor?: YearAnchor;
}

/** Text on one line, joined across small gaps. */
export interface Run {
  text: string;
  x: number;
  right: number;
  height: number;
}

/** One line of one page, split into cells by the dividers. */
export interface GridLine {
  /** 1-based. */
  page: number;
  /** 1-based, top to bottom on the page. */
  line: number;
  cells: string[];
}

/** Items closer than this (times the text height) in y share a line. */
const LINE_TOLERANCE = 0.4;
/** Items closer than this (times the text height) in x are one run. */
const WORD_GAP = 0.5;
/** Gaps wider than this (times the text height) get a space when joined. */
const SPACE_GAP = 0.1;

/** Groups a page's items into lines, top to bottom, each sorted left to right. */
export function groupLines(items: TextItem[]): TextItem[][] {
  const sorted = items
    .filter((i) => i.text.trim() !== "")
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    const ref = line?.[0];
    if (
      line &&
      ref &&
      Math.abs(ref.y - item.y) <=
        Math.max(item.height, ref.height) * LINE_TOLERANCE
    ) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

/** Joins neighbouring items of a line (up to a word space apart) into runs. */
export function joinRuns(line: TextItem[]): Run[] {
  const runs: Run[] = [];
  let current: Run | undefined;
  let lastItem: TextItem | undefined;
  for (const item of line) {
    const text = item.text.trim();
    if (text === "") continue;
    const height = Math.max(item.height, 1);
    if (current && lastItem) {
      const gap = item.x - current.right;
      if (gap <= Math.max(height, current.height) * WORD_GAP) {
        const spaced =
          gap > Math.max(height, current.height) * SPACE_GAP ||
          /\s$/.test(lastItem.text) ||
          /^\s/.test(item.text);
        current.text += (spaced ? " " : "") + text;
        current.right = Math.max(current.right, item.x + item.width);
        current.height = Math.max(current.height, height);
        lastItem = item;
        continue;
      }
    }
    current = { text, x: item.x, right: item.x + item.width, height };
    runs.push(current);
    lastItem = item;
  }
  return runs;
}

/** The cell index (0-based) a horizontal position falls into. */
export function cellIndex(dividers: number[], position: number): number {
  let index = 0;
  for (const d of dividers) if (position >= d) index++;
  return index;
}

function sortedDividers(dividers: number[]): number[] {
  return [...dividers].sort((a, b) => a - b);
}

/**
 * Builds one grid line per text line of every page. A run belongs to the cell
 * containing its midpoint, so right-aligned values of different widths land in
 * the same column.
 */
export function buildGrid(
  pages: PdfPageItems[],
  dividers: number[],
): GridLine[] {
  const ds = sortedDividers(dividers);
  const grid: GridLine[] = [];
  pages.forEach((page, p) => {
    groupLines(page.items).forEach((line, l) => {
      const cells: string[] = Array.from({ length: ds.length + 1 }, () => "");
      for (const run of joinRuns(line)) {
        const i = cellIndex(ds, (run.x + run.right) / 2);
        cells[i] = cells[i] ? `${cells[i]} ${run.text}` : run.text;
      }
      grid.push({ page: p + 1, line: l + 1, cells });
    });
  });
  return grid;
}

/** The first four-digit year in a text, if any. */
export function findYear(text: string): number | null {
  const m = text.match(/(?<!\d)((?:19|20)\d{2})(?!\d)/);
  return m ? Number(m[1]) : null;
}

/** The text item containing the point `anchor`, if any. */
export function itemAt(
  pages: PdfPageItems[],
  anchor: YearAnchor,
): TextItem | undefined {
  const page = pages[anchor.page - 1];
  const slack = 1;
  return page?.items.find(
    (i) =>
      anchor.x >= i.x - slack &&
      anchor.x <= i.x + i.width + slack &&
      anchor.y >= i.y - slack &&
      anchor.y <= i.y + Math.max(i.height, 1) + slack,
  );
}

const gutterWidth = (heights: number[]): number => {
  const avg = heights.reduce((a, b) => a + b, 0) / (heights.length || 1);
  return Math.max(4, avg);
};

/**
 * Suggests divider positions: the middle of every sizeable vertical gutter
 * that is empty on (nearly) every line that has more than one run.
 */
export function suggestDividers(pages: PdfPageItems[]): number[] {
  const all = pages.flatMap((p) => groupLines(p.items).map(joinRuns));
  const multi = all.filter((runs) => runs.length >= 2);
  const lines = multi.length > 0 ? multi : all;
  if (lines.length === 0) return [];
  const runs = lines.flat();
  const left = Math.floor(Math.min(...runs.map((r) => r.x)));
  const right = Math.ceil(Math.max(...runs.map((r) => r.right)));
  if (!(right > left)) return [];
  const coverage = new Array<number>(right - left + 1).fill(0);
  for (const line of lines) {
    const covered = new Set<number>();
    for (const r of line) {
      for (let x = Math.floor(r.x); x <= Math.ceil(r.right); x++) {
        covered.add(x - left);
      }
    }
    for (const x of covered) coverage[x] = (coverage[x] ?? 0) + 1;
  }
  const tolerance = Math.floor(lines.length * 0.05);
  const minWidth = gutterWidth(runs.map((r) => r.height));
  const dividers: number[] = [];
  let start: number | null = null;
  for (let x = 0; x <= coverage.length; x++) {
    const empty = x < coverage.length && (coverage[x] ?? 0) <= tolerance;
    if (empty && start === null) start = x;
    if (!empty && start !== null) {
      // Only gutters between text, not the margins.
      if (start > 0 && x < coverage.length && x - start >= minWidth) {
        dividers.push(Math.round((left + (start + x) / 2) * 10) / 10);
      }
      start = null;
    }
  }
  return dividers;
}

const dateFormatsFor = (
  values: string[],
): Array<DateFormat | YearlessDateFormat> => {
  const full = detectDateFormats(values);
  return full.length > 0 ? full : detectYearlessFormats(values);
};

/** Short cells only, so a heading mentioning a date is not a date cell. */
export function looksLikeDateCell(cell: string): boolean {
  return (
    (cell.length <= 14 &&
      DATE_FORMATS.some((f) => parseDate(cell, f) !== null)) ||
    (["DD MM", "MM DD"] as const).some((f) => parseMonthDay(cell, f) !== null)
  );
}

/** Guesses a starting configuration for an example PDF. */
export function guessAlignedConfig(
  pages: PdfPageItems[],
): AlignedColumnsConfig {
  const dividers = suggestDividers(pages);
  const grid = buildGrid(pages, dividers);
  const columnCount = dividers.length + 1;

  // The date column is the one where most lines have a date.
  let dateColumn = 0;
  let best = 0;
  for (let c = 0; c < columnCount; c++) {
    const n = grid.filter((g) => looksLikeDateCell(g.cells[c] ?? "")).length;
    if (n > best) {
      best = n;
      dateColumn = c;
    }
  }
  const dateValues = grid
    .map((g) => g.cells[dateColumn] ?? "")
    .filter(looksLikeDateCell);
  const dateFormat = dateFormatsFor(dateValues)[0] ?? "YYYY MM DD";

  const rows = grid
    .filter((g) => looksLikeDateCell(g.cells[dateColumn] ?? ""))
    .map((g) => g.cells.map((cell, c) => (c === dateColumn ? "" : cell)));
  const guess = guessMapping({ data: rows, offset: 0 });
  const columnOf = (field: string) => {
    const hit = Object.entries(guess.assignments).find(([, f]) => f === field);
    return hit ? Number(hit[0]) : undefined;
  };

  const amountColumn = columnOf("amount");
  const mapping: FieldMapping = {
    dateColumn,
    dateFormat,
    amount:
      amountColumn !== undefined
        ? { kind: "single", column: amountColumn }
        : ({ kind: "single" } as unknown as FieldMapping["amount"]),
    decimalSeparator: guess.decimalSeparator,
  };
  if (amountColumn !== undefined) {
    const cells = rows.map((r) => r[amountColumn] ?? "");
    if (cells.some((v) => /\d\s*cr$/i.test(v.trim())))
      mapping.creditMarker = "CR";
  }
  const payee = columnOf("payee");
  if (payee !== undefined) mapping.payeeColumn = payee;
  return { version: 1, dividers, mapping };
}

function isAnchor(v: unknown): v is YearAnchor {
  const a = v as YearAnchor | null;
  return (
    !!a &&
    typeof a === "object" &&
    Number.isInteger(a.page) &&
    a.page >= 1 &&
    Number.isFinite(a.x) &&
    Number.isFinite(a.y)
  );
}

export function validateAlignedConfig(input: unknown): string[] {
  const c = (input ?? {}) as Partial<AlignedColumnsConfig>;
  if (c.version !== 1) return ["Unsupported configuration version"];
  const errors: string[] = [];
  if (
    !Array.isArray(c.dividers) ||
    !c.dividers.every((d) => typeof d === "number" && Number.isFinite(d))
  ) {
    return ["Dividers must be a list of positions"];
  }
  const mapping = (c.mapping ?? {}) as Partial<FieldMapping>;
  errors.push(...validateMapping(mapping, true));
  const columnCount = c.dividers.length + 1;
  const used: unknown[] = [
    mapping.dateColumn,
    mapping.payeeColumn,
    mapping.notesColumn,
    mapping.importedIdColumn,
  ];
  const a = mapping.amount;
  if (a?.kind === "single") used.push(a.column);
  else if (a?.kind === "split") used.push(a.debitColumn, a.creditColumn);
  else if (a?.kind === "inOut") used.push(a.column, a.inOutColumn);
  if (used.some((u) => isIndex(u) && u >= columnCount)) {
    errors.push("A mapped column does not exist");
  }
  if (isYearlessFormat(mapping.dateFormat ?? "")) {
    if (c.yearAnchor === undefined) {
      errors.push("Click the text containing the year");
    } else if (!isAnchor(c.yearAnchor)) {
      errors.push("Year position is invalid");
    }
  }
  return errors;
}

const lineLabel = (g: GridLine) => `Page ${g.page}, line ${g.line}`;

export function runAlignedColumns(
  pages: PdfPageItems[],
  input: unknown,
  account: string,
): ApproachResult {
  const problems = validateAlignedConfig(input);
  if (problems.length > 0) {
    return { transactions: [], errors: [], warnings: problems };
  }
  const config = input as AlignedColumnsConfig;
  const { mapping } = config;
  const format = mapping.dateFormat;
  const grid = buildGrid(pages, config.dividers);
  const parsesDate = (cell: string) =>
    isYearlessFormat(format)
      ? parseMonthDay(cell, format) !== null
      : parseDate(cell, format) !== null;
  const rows = grid.filter((g) =>
    parsesDate(g.cells[mapping.dateColumn] ?? ""),
  );

  const transactions: Transaction[] = [];
  const errors: RowError[] = [];
  const warnings: string[] = [];
  if (rows.length === 0) {
    warnings.push(
      "No transactions found: no line has a date in the date column",
    );
    return { transactions, errors, warnings };
  }

  let dates: Array<string | null> | undefined;
  let rowMapping: FieldMapping = mapping;
  if (isYearlessFormat(format)) {
    const anchor = config.yearAnchor as YearAnchor;
    const year = findYear(itemAt(pages, anchor)?.text ?? "");
    const monthDays: MonthDay[] = rows.map(
      (g) =>
        parseMonthDay(g.cells[mapping.dateColumn] ?? "", format) as MonthDay,
    );
    if (year === null) {
      warnings.push(
        "The year could not be determined: no year was found at the saved position",
      );
      for (const g of rows) {
        errors.push({
          row: g.line,
          page: g.page,
          message: `${lineLabel(g)}: the year could not be determined`,
        });
      }
      return { transactions, errors, warnings };
    }
    const years = resolveYears(monthDays, year);
    const pad = (n: number) => String(n).padStart(2, "0");
    dates = monthDays.map(
      (md, i) => `${years[i]}-${pad(md.month)}-${pad(md.day)}`,
    );
    rowMapping = { ...mapping, dateFormat: "YYYY MM DD" };
  }

  rows.forEach((g, i) => {
    const cells = [...g.cells];
    const date = dates?.[i];
    if (date) cells[mapping.dateColumn] = date;
    const result = mapRow(rowMapping, cells, account);
    if (typeof result === "string") {
      errors.push({
        row: g.line,
        page: g.page,
        message: `${lineLabel(g)}: ${result}`,
      });
    } else {
      transactions.push(result);
    }
  });
  return { transactions, errors, warnings };
}

export const alignedColumns: Approach = {
  id: "aligned-columns",
  label: "Aligned columns",
  initialConfig: guessAlignedConfig,
  validateConfig: validateAlignedConfig,
  run: runAlignedColumns,
};
