import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadTypesTab } from "./UploadTypesTab.js";

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

describe("UploadTypesTab", () => {
  it("shows an empty state and lists existing types", async () => {
    render(<UploadTypesTab />);
    expect(await screen.findByText(/No upload types yet/)).toBeTruthy();
    cleanup();
    existing = [{ id: "1", name: "Desjardins", format: "csv" }];
    render(<UploadTypesTab />);
    expect(await screen.findByText("Desjardins")).toBeTruthy();
    expect(screen.getByText("CSV")).toBeTruthy();
  });

  async function openWizard(csv: string) {
    const user = userEvent.setup();
    render(<UploadTypesTab />);
    await user.click(await screen.findByText("New upload type"));
    await user.type(screen.getByLabelText("Name"), "Desjardins");
    await user.upload(
      screen.getByLabelText("Example CSV file"),
      new File([csv], "ex.csv", { type: "text/csv" }),
    );
    await screen.findByRole("table", { name: "Transaction preview" });
    return user;
  }
  const field = (label: string) =>
    screen.getByLabelText(label) as HTMLSelectElement;
  const optionsOf = (label: string) =>
    within(field(label))
      .queryAllByRole("option")
      .map((o) => o.textContent);
  const preview = () =>
    screen.getByRole("table", { name: "Transaction preview" });

  it("guesses the mapping, previews parsed values and saves", async () => {
    const user = await openWizard(CSV);
    const save = screen.getByRole("button", { name: "Save upload type" });

    // guessed from header names, which also selects the split layout
    expect(
      (screen.getByLabelText(/Split amount into separate/) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(field("Date").selectedOptions[0]?.textContent).toBe("Date");
    expect(field("Outflow").selectedOptions[0]?.textContent).toBe("Debit");
    expect(field("Inflow").selectedOptions[0]?.textContent).toBe("Credit");
    expect(field("Payee").selectedOptions[0]?.textContent).toBe("Description");

    // preview columns are the fields, filled from the mapping
    const headers = within(preview())
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "Date",
      "Payee",
      "Notes",
      "Source id",
      "Outflow",
      "Inflow",
    ]);
    expect(within(preview()).getByText("2024-01-05")).toBeTruthy();
    expect(within(preview()).getByText("Coffee")).toBeTruthy();
    expect(within(preview()).getByText("-4.50")).toBeTruthy();
    expect(within(preview()).getByText("100.00")).toBeTruthy();

    // A column already used by another field is not offered.
    expect(optionsOf("Notes")).not.toContain("Description");
    expect(optionsOf("Notes")).not.toContain("Date");
    expect(optionsOf("Notes")).not.toContain("Debit");

    // Freeing a field makes its column available again.
    await user.selectOptions(field("Payee"), "");
    expect(optionsOf("Notes")).toContain("Description");
    expect(within(preview()).queryByText("Coffee")).toBeNull();

    await user.selectOptions(field("Notes"), "Description");
    expect(within(preview()).getByText("Coffee")).toBeTruthy();
    expect((save as HTMLButtonElement).disabled).toBe(false);
    await user.click(save);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      name: "Desjardins",
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
    const user = await openWizard("foo,bar\nx,y\n");
    const save = screen.getByRole("button", { name: "Save upload type" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Date column is required")).toBeTruthy();

    await user.selectOptions(field("Date"), "foo");
    await user.selectOptions(field("Amount"), "bar");
    expect((save as HTMLButtonElement).disabled).toBe(false);
    // "x" isn't a date or amount, so the preview flags it.
    expect(within(preview()).getAllByText("Invalid").length).toBe(2);
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
    await user.selectOptions(field("In/Out"), "Description");
    await user.selectOptions(field("Amount"), "Debit");
    await user.type(screen.getByLabelText("In/Out outflow value"), "Coffee");
    expect(within(preview()).getByText("-4.50")).toBeTruthy();
  });
});
