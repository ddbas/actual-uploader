import type { ReactNode } from "react";
import {
  analyzeColumns,
  DATE_FORMATS,
  type DateFormat,
  detectDateFormats,
  detectYearlessFormats,
  type FieldKey,
  interpretRow,
  YEARLESS_DATE_FORMATS,
} from "statement-core";
import {
  type AmountKind,
  type MappingState,
  toFieldMapping,
} from "./mappingState.js";

const PREVIEW_ROWS = 5;

/** Which amount-related fields apply for each layout. */
const AMOUNT_FIELDS: Record<AmountKind, FieldKey[]> = {
  single: ["amount"],
  split: ["debit", "credit"],
  inOut: ["inOut", "amount"],
};

const AMOUNTISH: FieldKey[] = ["amount", "debit", "credit", "inOut"];

function isAllowed(field: FieldKey, kind: AmountKind): boolean {
  return !AMOUNTISH.includes(field) || AMOUNT_FIELDS[kind].includes(field);
}

const FIELD_LABELS: Record<FieldKey, string> = {
  date: "Date",
  payee: "Payee",
  notes: "Notes",
  importedId: "Transaction ID",
  amount: "Amount",
  debit: "Outflow",
  credit: "Inflow",
  inOut: "In/Out",
};

const REQUIRED_FIELDS: FieldKey[] = [
  "date",
  "amount",
  "debit",
  "credit",
  "inOut",
];

export interface MappingStepProps {
  state: MappingState;
  onChange: (state: MappingState) => void;
  /** Header row of the data, if there is one (used to label columns). */
  header?: string[];
  /** The data rows the columns are chosen from. */
  rows: string[][];
  columnCount: number;
  /** Offer the date formats without a year (PDF sources). */
  allowYearless?: boolean;
  /** Show the mapped transaction preview table (default true). */
  showPreview?: boolean;
  /** Extra option fieldsets shown before the amount and date options. */
  leading?: ReactNode;
}

/**
 * The column-mapping part of a source: amount and date options, one select per
 * transaction field, and a preview of the mapped rows. Shared by the CSV and
 * PDF source setups.
 */
export function MappingStep({
  state,
  onChange,
  header,
  rows: dataRows,
  columnCount,
  allowYearless = false,
  showPreview = true,
  leading,
}: MappingStepProps) {
  const {
    mapping,
    amountKind,
    dateFormat,
    decimalSeparator,
    flipAmount,
    creditMarker,
    outValue,
  } = state;
  const patch = (p: Partial<MappingState>) => onChange({ ...state, ...p });
  const setOutValue = (v: string) => patch({ outValue: v });
  const setFlipAmount = (v: boolean) => patch({ flipAmount: v });
  const setDecimalSeparator = (v: "." | ",") => patch({ decimalSeparator: v });
  const setDateFormat = (v: MappingState["dateFormat"]) =>
    patch({ dateFormat: v });
  const fieldMapping = toFieldMapping(state);
  const dateFormats: Array<MappingState["dateFormat"]> = allowYearless
    ? [...DATE_FORMATS, ...YEARLESS_DATE_FORMATS]
    : [...DATE_FORMATS];

  const detectFormats = (
    values: string[],
  ): Array<MappingState["dateFormat"]> => {
    const full = detectDateFormats(values);
    return full.length === 0 && allowYearless
      ? detectYearlessFormats(values)
      : full;
  };

  function assign(field: FieldKey, column: number | undefined) {
    const next: MappingState = {
      ...state,
      mapping: { ...state.mapping, [field]: column },
    };
    if (field === "date" && column !== undefined) {
      // Re-detect the format from every sample in the newly chosen column.
      const found = detectFormats(dataRows.map((r) => r[column] ?? ""));
      if (found[0]) next.dateFormat = found[0];
    }
    onChange(next);
  }

  function changeAmountKind(kind: AmountKind) {
    onChange({
      ...state,
      amountKind: kind,
      mapping: Object.fromEntries(
        Object.entries(state.mapping).filter(([f]) =>
          isAllowed(f as FieldKey, kind),
        ),
      ),
    });
  }

  // Show the date separator seen in the file in the format labels, as Actual does.
  const dateIndex = mapping.date;
  const dateSample =
    dateIndex === undefined ? "" : (dataRows[0]?.[dateIndex] ?? "");
  const dateSeparator = dateSample.match(/[/.,\-\\]/)?.[0] ?? " ";

  const money = (cents: number) => (cents / 100).toFixed(2);

  const visibleFields: FieldKey[] = [
    "date",
    "payee",
    "notes",
    "importedId",
    ...AMOUNT_FIELDS[amountKind],
  ];

  const columns = analyzeColumns(dataRows, columnCount);
  const headerCounts = new Map<string, number>();
  for (const h of header ?? []) {
    const k = h.trim();
    if (k) headerCounts.set(k, (headerCounts.get(k) ?? 0) + 1);
  }

  /**
   * "Description: COFFEE SHOP" — the header (or "Column N") plus the first
   * non-empty value, so columns are recognizable even with cryptic headers.
   * Duplicate header names get their column number.
   */
  function optionLabel(i: number): string {
    const h = header?.[i]?.trim() ?? "";
    const base = !h
      ? `Column ${i + 1}`
      : (headerCounts.get(h) ?? 0) > 1
        ? `${h} (column ${i + 1})`
        : h;
    const sample = columns[i]?.sample ?? "";
    const short = sample.length > 24 ? `${sample.slice(0, 23)}…` : sample;
    return short ? `${base}: ${short}` : base;
  }

  /** Whether a column could plausibly supply a field, based on its values. */
  function fits(field: FieldKey, i: number): boolean {
    const c = columns[i];
    if (!c?.hasValues) return false;
    if (field === "date") {
      return (
        c.looksLikeDate ||
        (allowYearless &&
          detectYearlessFormats(dataRows.map((r) => r[i] ?? "")).length > 0)
      );
    }
    if (field === "amount" || field === "debit" || field === "credit") {
      return c.looksLikeAmount;
    }
    return true;
  }

  const emptyColumns = columns.filter((c) => !c.hasValues).length;
  const dateCandidates =
    dateIndex === undefined
      ? []
      : detectFormats(dataRows.map((r) => r[dateIndex] ?? ""));
  const otherDateFormats = dateCandidates.filter((f) => f !== dateFormat);

  /** Outflow/inflow preview cell, derived from the final (flipped) amount. */
  function splitCell(
    amount: number | null,
    anyRaw: boolean,
    side: "out" | "in",
  ) {
    if (amount === null) {
      return anyRaw ? <span className="text-error">Invalid</span> : null;
    }
    if (side === "out") return amount < 0 ? money(amount) : null;
    return amount > 0 ? money(amount) : null;
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        {leading}
        <fieldset className="fieldset rounded-box border border-base-300 bg-base-200 p-4">
          <legend className="fieldset-legend">Amount options</legend>
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={amountKind === "split"}
              onChange={(e) =>
                changeAmountKind(e.target.checked ? "split" : "single")
              }
            />
            <span>Split amount into separate inflow/outflow columns</span>
          </label>
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={amountKind === "inOut"}
              onChange={(e) =>
                changeAmountKind(e.target.checked ? "inOut" : "single")
              }
            />
            <span>Select a column to specify if the amount goes in/out</span>
          </label>
          {amountKind === "inOut" ? (
            <label className="fieldset">
              <span className="label">In/Out outflow value</span>
              <input
                type="text"
                className="input"
                value={outValue}
                placeholder="Value for out rows, e.g. Debit"
                onChange={(e) => setOutValue(e.target.value)}
              />
            </label>
          ) : null}
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={flipAmount}
              onChange={(e) => setFlipAmount(e.target.checked)}
            />
            <span>Flip amount</span>
          </label>
          {amountKind === "single" ? (
            <label className="fieldset">
              <span className="label">Credit marker</span>
              <input
                type="text"
                className="input"
                value={creditMarker}
                placeholder="e.g. CR (amounts ending in it are inflows)"
                onChange={(e) => patch({ creditMarker: e.target.value })}
              />
            </label>
          ) : null}
          <label className="fieldset">
            <span className="label">Decimal separator</span>
            <select
              className="select"
              value={decimalSeparator}
              onChange={(e) => setDecimalSeparator(e.target.value as "." | ",")}
            >
              <option value=".">Period (1,234.56)</option>
              <option value=",">Comma (1.234,56)</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="fieldset rounded-box border border-base-300 bg-base-200 p-4">
          <legend className="fieldset-legend">Date options</legend>
          <label className="fieldset">
            <span className="label">Date format</span>
            <select
              className="select"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
            >
              {dateFormats.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/ /g, dateSeparator)}
                </option>
              ))}
            </select>
          </label>
          {otherDateFormats.length > 0 ? (
            <p className="text-sm opacity-70" role="note">
              The sample dates also fit{" "}
              {otherDateFormats
                .map((f) => f.replace(/ /g, dateSeparator))
                .join(", ")}
              . Check the preview.
            </p>
          ) : null}
          {mapping.date !== undefined && dateCandidates.length === 0 ? (
            <p className="text-sm text-error" role="note">
              No date format fits the sample dates.
            </p>
          ) : null}
        </fieldset>
      </div>

      <h3 className="text-lg font-semibold">Map fields to columns</h3>
      <p className="text-sm opacity-70">
        Columns were guessed from the file. Fields marked * are required; a
        column can only feed one field. Date fields list only columns that look
        like dates, amount fields only columns that look like amounts
        {emptyColumns > 0
          ? `, and ${emptyColumns} empty ${emptyColumns === 1 ? "column is" : "columns are"} hidden`
          : ""}
        .
      </p>
      <div className="flex flex-wrap gap-4">
        {visibleFields.map((field) => (
          <label key={field} className="field">
            <span
              className={`label ${REQUIRED_FIELDS.includes(field) ? "after:content-['*']" : ""}`}
            >
              {FIELD_LABELS[field]}
            </span>
            <select
              className="select"
              value={mapping[field] ?? ""}
              onChange={(e) =>
                assign(
                  field,
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            >
              <option value="">Choose field…</option>
              {Array.from({ length: columnCount }, (_, i) => i)
                .filter((i) => mapping[field] === i || fits(field, i))
                .map((i) => (
                  <option key={i} value={i}>
                    {optionLabel(i)}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>

      {showPreview ? (
        <>
          <h3 className="text-lg font-semibold">Transaction preview</h3>
          <div className="overflow-x-auto">
            <table
              className="table table-xs table-zebra"
              aria-label="Transaction preview"
            >
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Notes</th>
                  <th>Transaction ID</th>
                  {amountKind === "split" ? (
                    <>
                      <th>Outflow</th>
                      <th>Inflow</th>
                    </>
                  ) : (
                    <>
                      {amountKind === "inOut" ? <th>In/Out</th> : null}
                      <th>Amount</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, PREVIEW_ROWS).map((row, r) => {
                  const { date, amount } = interpretRow(fieldMapping, row);
                  const at = (f: FieldKey) => {
                    const c = mapping[f];
                    return c === undefined ? "" : (row[c] ?? "").trim();
                  };
                  const rawDate = at("date");
                  const anyRaw = at("debit") !== "" || at("credit") !== "";
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                    <tr key={r}>
                      <td>
                        {mapping.date === undefined ? null : (
                          <>
                            <span className="opacity-70">
                              {rawDate || "Empty"} →
                            </span>{" "}
                            <span
                              className={date ? "text-success" : "text-error"}
                            >
                              {date ?? "Invalid"}
                            </span>
                          </>
                        )}
                      </td>
                      <td>{at("payee")}</td>
                      <td>{at("notes")}</td>
                      <td>{at("importedId")}</td>
                      {amountKind === "split" ? (
                        <>
                          <td>{splitCell(amount, anyRaw, "out")}</td>
                          <td>{splitCell(amount, anyRaw, "in")}</td>
                        </>
                      ) : (
                        <>
                          {amountKind === "inOut" ? (
                            <td>{at("inOut")}</td>
                          ) : null}
                          <td
                            className={
                              mapping.amount !== undefined && amount === null
                                ? "text-error"
                                : undefined
                            }
                          >
                            {mapping.amount === undefined
                              ? ""
                              : amount === null
                                ? "Invalid"
                                : money(amount)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
