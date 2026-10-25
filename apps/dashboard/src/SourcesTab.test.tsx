import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourcesTab } from "./SourcesTab.js";

const CSV =
  "Date,Description,Debit,Credit\n2024-01-05,Coffee,4.50,\n2024-01-06,Pay,,100.00\n";

let saved: unknown[];
let existing: unknown[];

beforeEach(() => {
  saved = [];
  existing = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        saved.push(JSON.parse(init.body as string));
        return new Response(
          JSON.stringify({ id: "1", ...(saved[0] as object) }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify(existing), { status: 200 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SourcesTab", () => {
  it("shows an empty state and lists existing types", async () => {
    render(<SourcesTab />);
    expect(await screen.findByText(/No sources yet/)).toBeTruthy();
    cleanup();
    existing = [{ id: "1", name: "Example", format: "csv" }];
    render(<SourcesTab />);
    expect(await screen.findByText("Example")).toBeTruthy();
    expect(screen.getByText("CSV")).toBeTruthy();
  });

  it("asks for confirmation before deleting a source", async () => {
    existing = [{ id: "1", name: "Example", format: "csv" }];
    const user = userEvent.setup();
    render(<SourcesTab />);
    await user.click(await screen.findByLabelText("Delete Example"));
    const calls = () =>
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[1]?.method === "DELETE",
      );
    expect(calls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(calls()).toHaveLength(0);

    await user.click(screen.getByLabelText("Delete Example"));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(calls()).toHaveLength(1));
  });

  async function openWizard(csv: string) {
    const user = userEvent.setup();
    render(<SourcesTab />);
    await user.click(await screen.findByText("New source"));
    await user.type(screen.getByLabelText("Name"), "Example");
    await user.upload(
      screen.getByLabelText("Example CSV file"),
      new File([csv], "ex.csv", { type: "text/csv" }),
    );
    await screen.findByRole("table", { name: "Transaction preview" });
    return user;
  }
  const field = (label: string) =>
    screen.getByLabelText(label) as HTMLSelectElement;
  /** Option texts without the ": sample" suffix. */
  const optionsOf = (label: string) =>
    within(field(label))
      .queryAllByRole("option")
      .map((o) => (o.textContent ?? "").split(":")[0]);
  const selectedOf = (label: string) =>
    field(label).selectedOptions[0]?.textContent;
  const preview = () =>
    screen.getByRole("table", { name: "Transaction preview" });

  it("guesses the mapping, previews parsed values and saves", async () => {
    const user = await openWizard(CSV);
    const save = screen.getByRole("button", { name: "Save source" });

    // guessed from header names, which also selects the split layout
    expect(
      (screen.getByLabelText(/Split amount into separate/) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(selectedOf("Date")).toBe("Date: 2024-01-05");
    expect(selectedOf("Outflow")).toBe("Debit: 4.50");
    expect(selectedOf("Inflow")).toBe("Credit: 100.00");
    expect(selectedOf("Payee")).toBe("Description: Coffee");

    // preview columns are the fields, filled from the mapping
    const headers = within(preview())
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Date",
      "Payee",
      "Notes",
      "Transaction ID",
      "Outflow",
      "Inflow",
    ]);
    expect(within(preview()).getByText("2024-01-05")).toBeTruthy();
    expect(within(preview()).getByText("Coffee")).toBeTruthy();
    expect(within(preview()).getByText("-4.50")).toBeTruthy();
    expect(within(preview()).getByText("100.00")).toBeTruthy();

    // A column already used by another field is still offered, but the
    // same column cannot be saved twice.
    expect(optionsOf("Notes")).toContain("Description");
    await user.selectOptions(field("Notes"), "1");
    expect(
      screen.getByText("Payee and Notes cannot use the same column"),
    ).toBeTruthy();
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await user.selectOptions(field("Payee"), "");
    expect(screen.queryByText(/cannot use the same column/)).toBeNull();
    expect(within(preview()).getByText("Coffee")).toBeTruthy();
    expect((save as HTMLButtonElement).disabled).toBe(false);
    await user.click(save);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      name: "Example",
      format: "csv",
      hasHeader: true,
      dateColumn: 0,
      dateFormat: "YYYY MM DD",
      amount: { kind: "split", debitColumn: 2, creditColumn: 3 },
      notesColumn: 1,
    });
  });

  it("supports toggling split mode and flipping the amount", async () => {
    const user = await openWizard(
      "Date,Payee,Amount\n2024-01-05,Coffee,-4.50\n",
    );
    expect(screen.queryByLabelText("Outflow")).toBeNull();
    expect(within(preview()).getByText("-4.50")).toBeTruthy();

    await user.click(screen.getByLabelText("Flip amount"));
    expect(within(preview()).getByText("4.50")).toBeTruthy();

    await user.click(screen.getByLabelText(/Split amount into separate/));
    expect(screen.queryByLabelText("Amount")).toBeNull();
    expect(field("Outflow").value).toBe("");
    expect(field("Inflow").value).toBe("");
    // the amount mapping was dropped, so it's required again
    expect(
      screen.getByText(
        "Outflow column is required".replace("Outflow", "Debit"),
      ),
    ).toBeTruthy();
  });

  it("blocks saving until required fields are mapped", async () => {
    const user = await openWizard("foo,bar,baz\n2024-01-05,hello,12\n");
    const save = screen.getByRole("button", { name: "Save source" });
    expect(selectedOf("Date")).toBe("foo: 2024-01-05");
    expect(selectedOf("Amount")).toBe("baz: 12");
    expect((save as HTMLButtonElement).disabled).toBe(false);

    await user.selectOptions(field("Date"), "");
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Date column is required")).toBeTruthy();
  });

  it("only offers columns that can supply a field", async () => {
    await openWizard(
      "Date,Payee,Empty,Amount\n2024-01-05,Coffee,,-4.50\n2024-01-06,Pay,,100\n",
    );
    // text columns can't be a date or an amount; empty columns are never offered
    expect(optionsOf("Date")).toEqual(["Choose field…", "Date"]);
    expect(optionsOf("Amount")).toEqual(["Choose field…", "Amount"]);
    expect(optionsOf("Notes")).toEqual([
      "Choose field…",
      "Date",
      "Payee",
      "Amount",
    ]);
    expect(screen.getByText(/1 empty column is hidden/)).toBeTruthy();
  });

  it("detects the date format from all rows and flags ambiguity", async () => {
    const user = await openWizard(
      "Date,Amount\n05/03/2024,1\n06/03/2024,2\n31/03/2024,3\n",
    );
    // 31/03 rules out month-first
    expect(
      (screen.getByLabelText("Date format") as HTMLSelectElement).value,
    ).toBe("DD MM YYYY");
    expect(screen.queryByRole("note")).toBeNull();
    expect(within(preview()).getByText("2024-03-05")).toBeTruthy();
    cleanup();

    await openWizard("Date,Amount\n05/03/2024,1\n06/03/2024,2\n");
    expect(screen.getByRole("note").textContent).toMatch(
      /also fit DD\/MM\/YYYY/,
    );
    void user;
  });

  it("names options with the header and a sample value", async () => {
    await openWizard(
      "Date,Date,Note\n2024-01-05,2024-01-06,a very long memo that goes on and on\n",
    );
    const labels = within(field("Notes"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toContain("Note: a very long memo that g…");
    expect(
      within(field("Date"))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(expect.arrayContaining(["Date (column 2): 2024-01-06"]));
  });

  it("requires the in/out column and value in that layout", async () => {
    const user = await openWizard(CSV);
    await user.click(
      screen.getByLabelText(/specify if the amount goes in\/out/),
    );
    expect(screen.getByText("In/Out column is required")).toBeTruthy();
    expect(screen.getByText("Out value is required")).toBeTruthy();
    expect(screen.queryByLabelText("Outflow")).toBeNull();

    await user.selectOptions(field("Payee"), "");
    await user.selectOptions(field("In/Out"), "1");
    await user.selectOptions(field("Amount"), "2");
    await user.type(screen.getByLabelText("In/Out outflow value"), "Coffee");
    expect(within(preview()).getByText("-4.50")).toBeTruthy();
  });
});
