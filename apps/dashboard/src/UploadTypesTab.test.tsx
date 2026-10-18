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

  it("blocks saving until required fields are mapped, then saves", async () => {
    const user = userEvent.setup();
    render(<UploadTypesTab />);
    await user.click(await screen.findByText("New upload type"));

    const save = screen.getByRole("button", { name: "Save upload type" });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Name"), "Desjardins");
    await user.upload(
      screen.getByLabelText("Example CSV file"),
      new File([CSV], "ex.csv", { type: "text/csv" }),
    );
    const preview = await screen.findByRole("table", { name: "File preview" });
    expect(within(preview).getByText("Coffee")).toBeTruthy();
    // header row is excluded from the data rows
    expect(within(preview).getAllByText("Description")).toHaveLength(1);
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Date column is required")).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Date column"), "Date");
    await user.selectOptions(screen.getByLabelText("Amount layout"), "split");
    await user.selectOptions(screen.getByLabelText("Debit column"), "Debit");
    await user.selectOptions(screen.getByLabelText("Credit column"), "Credit");
    await user.selectOptions(
      screen.getByLabelText("Payee column"),
      "Description",
    );

    const txPreview = await screen.findByRole("table", {
      name: "Transaction preview",
    });
    expect(within(txPreview).getByText("-4.50")).toBeTruthy();
    expect(within(txPreview).getByText("100.00")).toBeTruthy();

    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(save);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      name: "Desjardins",
      format: "csv",
      hasHeader: true,
      dateColumn: 0,
      amount: { kind: "split", debitColumn: 2, creditColumn: 3 },
      payeeColumn: 1,
    });
  });
});
