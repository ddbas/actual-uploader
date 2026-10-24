import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import {
  type Approach,
  type ApproachId,
  alignedColumns,
  type SourceDraft,
} from "statement-core";
import { FIXTURE_PAGES } from "statement-core/testing";
import type { PdfDocument } from "statement-pdf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlignedColumnsEditor } from "./AlignedColumnsEditor.js";
import type { EditorProps } from "./editors.js";
import { PdfSourceSetup } from "./PdfSourceSetup.js";
import { loadPdf } from "./pdfLoader.js";

vi.mock("./pdfLoader.js", () => ({
  loadPdf: vi.fn(),
  describePdfError: (e: { code?: string }) =>
    e.code === "no-text"
      ? "This PDF has no readable text. Scanned PDFs are not supported."
      : e.code === "encrypted"
        ? "This PDF is password-protected and cannot be read."
        : "This file could not be read as a PDF.",
}));

const fakeDoc = (): PdfDocument => ({
  pages: FIXTURE_PAGES,
  renderPage: vi.fn(async () => {}),
  destroy: vi.fn(async () => {}),
});

let saved: SourceDraft[];
const onSave = async (d: SourceDraft) => {
  saved.push(d);
};

beforeEach(() => {
  saved = [];
  vi.mocked(loadPdf).mockResolvedValue(fakeDoc());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function setup(
  props: Partial<Parameters<typeof PdfSourceSetup>[0]> = {},
) {
  const user = userEvent.setup();
  render(
    <PdfSourceSetup
      name="Card"
      onSave={onSave}
      onCancel={() => {}}
      {...props}
    />,
  );
  await user.upload(
    screen.getByLabelText("Example PDF file"),
    new File(["%PDF"], "statement.pdf", { type: "application/pdf" }),
  );
  return user;
}
const dividers = () => screen.queryAllByRole("slider");
const selectedOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLSelectElement).selectedOptions[0]
    ?.textContent;
const save = () => screen.getByRole("button", { name: "Save source" });

describe("PdfSourceSetup: the example PDF", () => {
  it("shows the first page and navigates between pages", async () => {
    const user = await setup();
    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });

  it.each([
    ["no-text", /no readable text.*Scanned PDFs are not supported/],
    ["encrypted", /password-protected/],
  ])("explains a PDF that cannot be read (%s)", async (code, message) => {
    vi.mocked(loadPdf).mockRejectedValue({ code });
    await setup();
    expect((await screen.findByRole("alert")).textContent).toMatch(message);
    expect(screen.queryByLabelText("Extraction approach")).toBeNull();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });
});

describe("PdfSourceSetup: approaches", () => {
  it("lists approaches with Aligned columns selected", async () => {
    await setup();
    const select = (await screen.findByLabelText(
      "Extraction approach",
    )) as HTMLSelectElement;
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Aligned columns"]);
    expect(select.selectedOptions[0]?.textContent).toBe("Aligned columns");
  });

  it("restores an approach's settings after switching away and back", async () => {
    const other: Approach = {
      id: "other",
      label: "Other",
      initialConfig: () => ({ n: 0 }),
      validateConfig: () => [],
      run: () => ({ transactions: [], errors: [], warnings: [] }),
    };
    const OtherEditor: ComponentType<EditorProps> = ({ config, onChange }) => {
      const n = (config as { n: number }).n;
      return (
        <button type="button" onClick={() => onChange({ n: n + 1 })}>
          bump {n}
        </button>
      );
    };
    const user = await setup({
      approaches: { "aligned-columns": alignedColumns, other },
      editors: { "aligned-columns": AlignedColumnsEditor, other: OtherEditor },
    });
    const select = await screen.findByLabelText("Extraction approach");
    await user.click(screen.getByRole("button", { name: "Remove divider 1" }));
    expect(dividers()).toHaveLength(2);

    await user.selectOptions(select, "other");
    expect(dividers()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "bump 0" }));

    await user.selectOptions(select, "aligned-columns");
    expect(dividers()).toHaveLength(2);
    await user.selectOptions(select, "other");
    expect(screen.getByRole("button", { name: "bump 1" })).toBeTruthy();
  });

  it("requires an editor for every registered approach (types)", () => {
    // @ts-expect-error a missing editor is a compile error
    const missing: Record<ApproachId, ComponentType<EditorProps>> = {};
    expect(missing).toEqual({});
  });
});

describe("Aligned columns editor", () => {
  it("suggests dividers that can be moved, added and removed", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    expect(dividers()).toHaveLength(3);
    const first = dividers()[0] as HTMLElement;
    const before = Number(first.getAttribute("aria-valuenow"));
    first.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(Number(dividers()[0]?.getAttribute("aria-valuenow"))).toBe(
      before + 2,
    );
    await user.click(screen.getByRole("button", { name: "Add divider" }));
    expect(dividers()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Remove divider 4" }));
    expect(dividers()).toHaveLength(3);
  });

  it("keeps dividers over the same text when zooming", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    const divider = () => dividers()[0] as HTMLElement;
    const x = divider().getAttribute("aria-valuenow");
    const left = () =>
      Number.parseFloat(divider().parentElement?.style.left ?? "0");
    const zoomed = left();
    const percent = () => screen.getByLabelText("Zoom level").textContent;
    expect(percent()).toBe("140%");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(percent()).toBe("170%");
    // pixels follow the zoom; the stored position in points does not
    expect(left()).toBeCloseTo((zoomed / 1.4) * 1.7, 1);
    expect(divider().getAttribute("aria-valuenow")).toBe(x);
  });

  it("applies the dividers to every page", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    const x = dividers().map((d) => d.getAttribute("aria-valuenow"));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(dividers().map((d) => d.getAttribute("aria-valuenow"))).toEqual(x);
  });

  it("guesses the mapping and shows the same controls as CSV", async () => {
    await setup();
    await screen.findByText("Page 1 of 2");
    expect(selectedOf("Date")).toMatch(/^Column 1: 28 12$/);
    expect(selectedOf("Amount")).toMatch(/^Column 4: 59,00$/);
    expect(selectedOf("Payee")).toMatch(/^Column 3: LES GRILLADES/);
    expect(
      (screen.getByLabelText("Credit marker") as HTMLInputElement).value,
    ).toBe("CR");
    expect(screen.getByLabelText("Decimal separator")).toBeTruthy();
    expect(screen.getByLabelText("Flip amount")).toBeTruthy();
    const formats = within(screen.getByLabelText("Date format"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(formats).toContain("DD MM");
    expect(formats).toContain("YYYY MM DD");
  });

  it("blocks saving until the required fields are mapped", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    await user.selectOptions(screen.getByLabelText("Amount"), "");
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Amount column is required")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Amount"), "3");
    await user.selectOptions(screen.getByLabelText("Payee"), "3");
    expect(
      screen.getByText("Payee and Amount cannot use the same column"),
    ).toBeTruthy();
    expect((save() as HTMLButtonElement).disabled).toBe(true);
  });

  it("merges columns by removing a divider", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    await user.click(screen.getByRole("button", { name: "Remove divider 1" }));
    expect(dividers()).toHaveLength(2);
    expect(
      within(screen.getByLabelText("Date"))
        .getAllByRole("option")
        .some((o) => /28 12 29 12/.test(o.textContent ?? "")),
    ).toBe(true);
  });
});

describe("Year-less dates", () => {
  const YEAR = 'Use "Statement date: 15 Jan 2026" as the year';

  it("asks for the year, rejects text without one, and unblocks saving", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    expect(screen.getByText(/dates have no year/)).toBeTruthy();
    expect(screen.getByText("Click the text containing the year")).toBeTruthy();
    expect((save() as HTMLButtonElement).disabled).toBe(true);

    await user.click(
      screen.getByRole("button", {
        name: 'Use "ACCOUNT STATEMENT" as the year',
      }),
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /has no year/,
    );
    expect((save() as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: YEAR }));
    expect(screen.getByText("2026")).toBeTruthy();
    expect(screen.getByTestId("year-highlight")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect((save() as HTMLButtonElement).disabled).toBe(false);
  });

  it("previews rolled-over years and matches what the server would return", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    await user.click(screen.getByRole("button", { name: YEAR }));

    const table = screen.getByRole("table", { name: "Transaction preview" });
    const shown = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((r) =>
        within(r)
          .getAllByRole("cell")
          .map((c) => c.textContent),
      );
    expect(shown.map((r) => r[0])).toEqual([
      "2025-12-28",
      "2025-12-30",
      "2026-01-03",
      "2026-01-05",
      "2026-01-09",
    ]);

    await user.click(save());
    await waitFor(() => expect(saved).toHaveLength(1));
    const draft = saved[0] as Extract<SourceDraft, { format: "pdf" }>;
    expect(draft).toMatchObject({
      name: "Card",
      format: "pdf",
      approach: "aligned-columns",
    });
    // the saved source run on the same PDF gives the previewed transactions
    const run = alignedColumns.run(FIXTURE_PAGES, draft.config, "preview");
    expect(
      run.transactions.map((t) => [
        t.date,
        t.payee_name ?? "",
        t.notes ?? "",
        ((t.amount ?? 0) / 100).toFixed(2),
      ]),
    ).toEqual(shown);
  });

  it("does not ask for a year when the dates have one", async () => {
    const user = await setup();
    await screen.findByText("Page 1 of 2");
    await user.selectOptions(
      screen.getByLabelText("Date format"),
      "DD MM YYYY",
    );
    expect(screen.queryByText(/dates have no year/)).toBeNull();
  });
});
