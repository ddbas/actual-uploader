import type { PdfPageItems, TextItem } from "./types.js";

/**
 * Synthetic statement modelled on a real credit card statement's layout (the
 * real column positions and fragmentation patterns) with invented names and
 * amounts. It contains no personal data.
 *
 * Columns (PDF points): transaction day (x=40) and month (x=58), posting day
 * (x=80) and month (x=98), description (x=130), amount right-aligned at 560.
 * Dates have no year; the statement date line carries it.
 */
const H = 8;
const CHAR = 4.4;
/** Space between words and between a day and its month. */
const SPACE = 2;
const DAY_MONTH_GAP = 6;

const item = (text: string, x: number, y: number): TextItem => ({
  text,
  x,
  y,
  width: text.length * CHAR,
  height: H,
});

/** Words laid out left to right from x, separated by a word space. */
function words(ws: string[], x: number, y: number): TextItem[] {
  const out: TextItem[] = [];
  let cursor = x;
  for (const w of ws) {
    const it = item(w, cursor, y);
    out.push(it);
    cursor += it.width + SPACE;
  }
  return out;
}

/** A right-aligned amount; thousands digits may be a separate item. */
function amount(parts: string[], y: number, right = 560): TextItem[] {
  const total =
    parts.reduce((n, p) => n + p.length * CHAR, 0) + (parts.length - 1) * 2;
  return words(parts, right - total, y).map((it) => it);
}

function dateCells(day: string, month: string, x: number, y: number) {
  const d = item(day, x, y);
  return [d, item(month, x + d.width + DAY_MONTH_GAP, y)];
}

interface Row {
  date: [string, string];
  posted: [string, string];
  description: string[];
  amount: string[];
}

function rowItems(r: Row, y: number): TextItem[] {
  return [
    ...dateCells(r.date[0], r.date[1], 40, y),
    ...dateCells(r.posted[0], r.posted[1], 80, y),
    ...words(r.description, 130, y),
    ...amount(r.amount, y),
  ];
}

const header = (y: number): TextItem[] => [
  item("Date", 40, y),
  item("Posted", 80, y),
  item("Description", 130, y),
  item("Amount", 520, y),
];

export const FIXTURE_ROWS: Row[] = [
  {
    date: ["28", "12"],
    posted: ["29", "12"],
    description: ["LES", "GRILLADES", "DU", "PORT"],
    amount: ["59,00"],
  },
  {
    date: ["30", "12"],
    posted: ["31", "12"],
    description: ["CAFE", "DU", "COIN"],
    amount: ["4,50"],
  },
  {
    date: ["03", "01"],
    posted: ["04", "01"],
    description: ["PAIEMENT", "MERCI"],
    amount: ["1", "979,73CR"],
  },
  {
    date: ["05", "01"],
    posted: ["06", "01"],
    description: ["EPICERIE", "MODELE", "MONTREAL", "QC"],
    amount: ["113,83"],
  },
  {
    date: ["09", "01"],
    posted: ["10", "01"],
    description: ["REMBOURSEMENT"],
    amount: ["113,83CR"],
  },
];

/** Where the year text sits on page 1 (for the year anchor). */
export const FIXTURE_YEAR_ITEM = item("Statement date: 15 Jan 2026", 40, 740);

export const FIXTURE_PAGES: PdfPageItems[] = [
  {
    width: 612,
    height: 792,
    items: [
      item("ACCOUNT STATEMENT", 40, 760),
      FIXTURE_YEAR_ITEM,
      ...header(700),
      ...rowItems(FIXTURE_ROWS[0] as Row, 686),
      ...rowItems(FIXTURE_ROWS[1] as Row, 672),
      ...rowItems(FIXTURE_ROWS[2] as Row, 658),
      item("Page 1 of 2", 280, 30),
    ],
  },
  {
    width: 612,
    height: 792,
    items: [
      ...header(740),
      ...rowItems(FIXTURE_ROWS[3] as Row, 726),
      ...rowItems(FIXTURE_ROWS[4] as Row, 712),
      ...words(["Total", "purchases"], 130, 690),
      ...amount(["1", "234,56"], 690),
      item("Page 2 of 2", 280, 30),
    ],
  },
];
