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
    await screen.findByRole("table", { name: "File preview" });
    return user;
  }
  const field = (col: string) =>
    screen.getByLabelText(`Field for ${col}`) as HTMLSelectElement;
  const optionsOf = (col: string) =>
    within(field(col))
      .queryAllByRole("option")
      .map((o) => o.textContent);

  it("guesses the mapping, previews parsed values and saves", async () => {
    const user = await openWizard(CSV);
    const save = screen.getByRole("button", { name: "Save upload type" });

    // header row is excluded from the data rows
    const preview = screen.getByRole("table", { name: "File preview" });
    expect(within(preview).getAllByText("Description")).toHaveLength(1);

    // guessed from header names
    expect(field("Date").value).toBe("date");
    expect(field("Debit").value).toBe("debit");
    expect(field("Credit").value).toBe("credit");
    expect(field("Description").value).toBe("payee");
    expect(
      (screen.getByLabelText("Amount layout") as HTMLSelectElement).value,
    ).toBe("split");

    const txPreview = screen.getByRole("table", {
      name: "Transaction preview",
    });
    expect(within(txPreview).getByText("2024-01-05")).toBeTruthy();
    expect(within(txPreview).getByText("-4.50")).toBeTruthy();
    expect(within(txPreview).getByText("100.00")).toBeTruthy();

    // A field already used is not offered on other columns.
    expect(optionsOf("Description")).not.toContain("Date *");
    expect(optionsOf("Description")).toContain("Payee");
    expect(optionsOf("Debit")).not.toContain("Payee");
    expect(optionsOf("Credit")).not.toContain("Debit *");

    // Freeing a field makes it available again.
    await user.selectOptions(field("Description"), "");
    expect(optionsOf("Debit")).toContain("Payee");

    await user.selectOptions(field("Description"), "notes");
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

  it("blocks saving until required fields are mapped", async () => {
    const user = await openWizard("foo,bar\nx,y\n");
    const save = screen.getByRole("button", { name: "Save upload type" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Date column is required")).toBeTruthy();
    expect(
      screen.queryByRole("table", { name: "Transaction preview" }),
    ).toBeNull();

    await user.selectOptions(field("foo"), "date");
    await user.selectOptions(field("bar"), "amount");
    expect((save as HTMLButtonElement).disabled).toBe(false);
    // "x" isn't a date or amount, so the preview flags it.
    expect(screen.getAllByText("Invalid").length).toBeGreaterThan(0);
  });

  it("requires the in/out column and value in that layout", async () => {
    const user = await openWizard(CSV);
    await user.selectOptions(screen.getByLabelText("Amount layout"), "inOut");
    expect(screen.getByText("In/Out column is required")).toBeTruthy();
    expect(screen.getByText("Out value is required")).toBeTruthy();
    // debit/credit assignments were dropped for the new layout
    expect(optionsOf("Debit")).toContain("In/Out *");
    expect(optionsOf("Debit")).not.toContain("Credit *");
  });
});
