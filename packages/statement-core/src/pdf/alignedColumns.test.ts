import { describe, expect, it } from "vitest";
import {
  type AlignedColumnsConfig,
  buildGrid,
  groupLines,
  guessAlignedConfig,
  joinRuns,
  runAlignedColumns,
  suggestDividers,
  validateAlignedConfig,
} from "./alignedColumns.js";
import { FIXTURE_PAGES, FIXTURE_YEAR_ITEM } from "./fixture.js";
import { APPROACH_IDS, getApproach } from "./registry.js";
import type { PdfPageItems } from "./types.js";

const anchor = {
  page: 1,
  x: FIXTURE_YEAR_ITEM.x + 2,
  y: FIXTURE_YEAR_ITEM.y + 2,
};

const config = (): AlignedColumnsConfig => ({
  ...guessAlignedConfig(FIXTURE_PAGES),
  yearAnchor: anchor,
});

describe("fixture", () => {
  it("contains no personal data", () => {
    const text = FIXTURE_PAGES.flatMap((p) => p.items.map((i) => i.text)).join(
      "\n",
    );
    expect(text).not.toMatch(/\d{3}[- ]?\d{3}[- ]?\d{4}/); // phone numbers
    expect(text).not.toMatch(/\d{9,}/); // account / card numbers
    expect(text).not.toMatch(/@/);
  });
});

describe("lines and runs", () => {
  it("tolerates small baseline differences", () => {
    const lines = groupLines([
      { text: "a", x: 0, y: 100, width: 5, height: 8 },
      { text: "b", x: 20, y: 100.8, width: 5, height: 8 },
      { text: "c", x: 0, y: 90, width: 5, height: 8 },
    ]);
    expect(lines.map((l) => l.map((i) => i.text))).toEqual([["a", "b"], ["c"]]);
  });

  it("keeps words and split digits together", () => {
    const lines = groupLines(FIXTURE_PAGES[0]?.items ?? []);
    const runsOf = (needle: string) =>
      lines
        .map(joinRuns)
        .find((runs) => runs.some((r) => r.text.includes(needle)))
        ?.map((r) => r.text);
    expect(runsOf("GRILLADES")).toEqual([
      "28",
      "12",
      "29",
      "12",
      "LES GRILLADES DU PORT",
      "59,00",
    ]);
    expect(runsOf("979")).toContain("1 979,73CR");
  });
});

describe("grid", () => {
  const dividers = suggestDividers(FIXTURE_PAGES);

  it("suggests dividers between the aligned groups", () => {
    // date | posting day | posting month... merged day+month, then the
    // description and the amount
    expect(dividers).toHaveLength(3);
    const [a = 0, b = 0, c = 0] = dividers;
    expect(a).toBeGreaterThan(40 + 2 * 4.4 + 6 + 2 * 4.4);
    expect(a).toBeLessThan(80);
    expect(b).toBeGreaterThan(80 + 8.8 + 6 + 8.8);
    expect(b).toBeLessThan(130);
    expect(c).toBeGreaterThan(130 + 4.4 * 40);
    expect(c).toBeLessThan(520);
  });

  it("assigns right-aligned amounts to one column", () => {
    const grid = buildGrid(FIXTURE_PAGES, dividers);
    const amounts = grid
      .filter((g) => g.cells[0] !== "" && /\d/.test(g.cells[0] ?? ""))
      .map((g) => g.cells[3]);
    expect(amounts).toEqual([
      "59,00",
      "4,50",
      "1 979,73CR",
      "113,83",
      "113,83CR",
    ]);
  });

  it("covers every page in document order", () => {
    const grid = buildGrid(FIXTURE_PAGES, dividers);
    expect(grid.map((g) => g.page)).toEqual(
      [...grid.map((g) => g.page)].sort(),
    );
    expect(new Set(grid.map((g) => g.page))).toEqual(new Set([1, 2]));
  });
});

describe("guess", () => {
  it("pre-assigns date, amount, payee and the credit marker", () => {
    const g = guessAlignedConfig(FIXTURE_PAGES);
    expect(g.mapping.dateColumn).toBe(0);
    expect(g.mapping.dateFormat).toBe("DD MM");
    expect(g.mapping.amount).toEqual({ kind: "single", column: 3 });
    expect(g.mapping.payeeColumn).toBe(2);
    expect(g.mapping.decimalSeparator).toBe(",");
    expect(g.mapping.creditMarker).toBe("CR");
  });
});

describe("run", () => {
  it("extracts transactions, resolving years across the boundary", () => {
    const r = runAlignedColumns(FIXTURE_PAGES, config(), "acc");
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.transactions).toEqual([
      {
        account: "acc",
        date: "2025-12-28",
        amount: -5900,
        payee_name: "LES GRILLADES DU PORT",
        imported_payee: "LES GRILLADES DU PORT",
      },
      expect.objectContaining({ date: "2025-12-30", amount: -450 }),
      expect.objectContaining({ date: "2026-01-03", amount: 197973 }),
      expect.objectContaining({ date: "2026-01-05", amount: -11383 }),
      expect.objectContaining({ date: "2026-01-09", amount: 11383 }),
    ]);
  });

  it("flips after the credit marker", () => {
    const c = config();
    c.mapping.flipAmount = true;
    const r = runAlignedColumns(FIXTURE_PAGES, c, "acc");
    expect(r.transactions[2]?.amount).toBe(-197973);
  });

  it("ignores lines without a date", () => {
    const r = runAlignedColumns(FIXTURE_PAGES, config(), "acc");
    expect(r.transactions).toHaveLength(5);
    expect(r.errors).toEqual([]);
  });

  it("warns when nothing is found", () => {
    const c = config();
    c.mapping.dateColumn = 2; // descriptions are not dates
    c.mapping.payeeColumn = undefined;
    const r = runAlignedColumns(FIXTURE_PAGES, c, "acc");
    expect(r.transactions).toEqual([]);
    expect(r.warnings[0]).toMatch(/No transactions found/);
  });

  it("reports page and line for a row with an invalid amount", () => {
    const c = config();
    c.mapping.amount = { kind: "single", column: 2 }; // description column
    c.mapping.payeeColumn = 1;
    const r = runAlignedColumns(FIXTURE_PAGES, c, "acc");
    expect(r.transactions).toEqual([]);
    expect(r.errors[0]).toMatchObject({ page: 1, row: 4 });
    expect(r.errors[0]?.message).toMatch(/Page 1, line 4/);
  });

  it("errors on every row when the year text is missing", () => {
    const c = config();
    c.yearAnchor = { page: 1, x: 1, y: 1 };
    const r = runAlignedColumns(FIXTURE_PAGES, c, "acc");
    expect(r.transactions).toEqual([]);
    expect(r.errors).toHaveLength(5);
    expect(r.warnings[0]).toMatch(/year could not be determined/);
  });

  it("does not need an anchor when dates carry a year", () => {
    const pages: PdfPageItems[] = [
      {
        width: 600,
        height: 800,
        items: [
          { text: "2026-03-04", x: 40, y: 700, width: 44, height: 8 },
          { text: "COFFEE", x: 130, y: 700, width: 26, height: 8 },
          { text: "4.50", x: 520, y: 700, width: 18, height: 8 },
        ],
      },
    ];
    const c: AlignedColumnsConfig = {
      version: 1,
      dividers: [100, 300],
      mapping: {
        dateColumn: 0,
        dateFormat: "YYYY MM DD",
        amount: { kind: "single", column: 2 },
        decimalSeparator: ".",
        payeeColumn: 1,
      },
    };
    const r = runAlignedColumns(pages, c, "acc");
    expect(r.transactions).toEqual([
      expect.objectContaining({ date: "2026-03-04", amount: 450 }),
    ]);
  });
});

describe("config validation and registry", () => {
  it("accepts the guessed config with an anchor", () => {
    expect(validateAlignedConfig(config())).toEqual([]);
  });
  it("requires a year anchor for year-less dates", () => {
    const c = guessAlignedConfig(FIXTURE_PAGES);
    expect(validateAlignedConfig(c)).toContain(
      "Click the text containing the year",
    );
  });
  it("rejects unknown versions, missing columns and bad markers", () => {
    expect(validateAlignedConfig({ version: 2 })).toHaveLength(1);
    expect(validateAlignedConfig(undefined)).toHaveLength(1);
    const c = config();
    c.mapping.amount = { kind: "single", column: 9 };
    expect(validateAlignedConfig(c)).toContain(
      "A mapped column does not exist",
    );
    const d = config();
    d.mapping.creditMarker = "12";
    expect(validateAlignedConfig(d)).not.toEqual([]);
  });
  it("registers the approach", () => {
    expect(APPROACH_IDS).toEqual(["aligned-columns"]);
    expect(getApproach("aligned-columns")?.label).toBe("Aligned columns");
    expect(getApproach("nope")).toBeUndefined();
    expect(getApproach("toString")).toBeUndefined();
  });
});
