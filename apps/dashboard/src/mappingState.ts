import type {
  AmountSource,
  DateFormat,
  FieldKey,
  FieldMapping,
  YearlessDateFormat,
} from "statement-core";

export type AmountKind = "single" | "split" | "inOut";

/** Editable form of a `FieldMapping`: every field may still be unset. */
export interface MappingState {
  /** Which column (by index) supplies each transaction field. */
  mapping: Partial<Record<FieldKey, number>>;
  amountKind: AmountKind;
  dateFormat: DateFormat | YearlessDateFormat;
  decimalSeparator: "." | ",";
  flipAmount: boolean;
  creditMarker: string;
  outValue: string;
}

export const emptyMappingState = (): MappingState => ({
  mapping: {},
  amountKind: "single",
  dateFormat: "YYYY MM DD",
  decimalSeparator: ".",
  flipAmount: false,
  creditMarker: "",
  outValue: "",
});

/** The (possibly incomplete) mapping fields of a source draft. */
export function toFieldMapping(state: MappingState): FieldMapping {
  const col = (f: FieldKey) => state.mapping[f];
  const amount =
    state.amountKind === "single"
      ? { kind: "single", column: col("amount") }
      : state.amountKind === "split"
        ? {
            kind: "split",
            debitColumn: col("debit"),
            creditColumn: col("credit"),
          }
        : {
            kind: "inOut",
            column: col("amount"),
            inOutColumn: col("inOut"),
            outValue: state.outValue,
          };
  const marker = state.creditMarker.trim();
  return {
    dateColumn: col("date"),
    dateFormat: state.dateFormat,
    amount,
    decimalSeparator: state.decimalSeparator,
    flipAmount: state.flipAmount,
    creditMarker: state.amountKind === "single" && marker ? marker : undefined,
    payeeColumn: col("payee"),
    notesColumn: col("notes"),
    importedIdColumn: col("importedId"),
  } as FieldMapping;
}

export function fromFieldMapping(m: Partial<FieldMapping>): MappingState {
  const mapping: Partial<Record<FieldKey, number>> = {};
  const set = (f: FieldKey, v: number | undefined) => {
    if (v !== undefined) mapping[f] = v;
  };
  set("date", m.dateColumn);
  set("payee", m.payeeColumn);
  set("notes", m.notesColumn);
  set("importedId", m.importedIdColumn);
  const a: AmountSource | undefined = m.amount;
  if (a?.kind === "single") set("amount", a.column);
  else if (a?.kind === "split") {
    set("debit", a.debitColumn);
    set("credit", a.creditColumn);
  } else if (a?.kind === "inOut") {
    set("amount", a.column);
    set("inOut", a.inOutColumn);
  }
  return {
    mapping,
    amountKind: a?.kind ?? "single",
    dateFormat: m.dateFormat ?? "YYYY MM DD",
    decimalSeparator: m.decimalSeparator ?? ".",
    flipAmount: m.flipAmount ?? false,
    creditMarker: m.creditMarker ?? "",
    outValue: a?.kind === "inOut" ? a.outValue : "",
  };
}
