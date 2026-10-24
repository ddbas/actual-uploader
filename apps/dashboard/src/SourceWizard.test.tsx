import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceWizard } from "./SourceWizard.js";

vi.mock("./pdfLoader.js", () => ({
  loadPdf: vi.fn(),
  describePdfError: () => "",
}));

afterEach(cleanup);

const CSV =
  'Date,Description,Amount\n2024-01-05,Coffee,"59,00"\n2024-01-06,Refund,"113,83CR"\n';

describe("SourceWizard", () => {
  it("shows the CSV setup by default and the PDF setup when chosen", async () => {
    const user = userEvent.setup();
    render(<SourceWizard onSave={async () => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Example CSV file")).toBeTruthy();
    expect(screen.queryByLabelText("Example PDF file")).toBeNull();

    await user.click(screen.getByRole("radio", { name: "PDF" }));
    expect(screen.getByLabelText("Example PDF file")).toBeTruthy();
    expect(screen.queryByLabelText("Example CSV file")).toBeNull();
    expect(screen.getByLabelText("Name")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "CSV" }));
    expect(screen.getByLabelText("Example CSV file")).toBeTruthy();
  });

  it("previews a credit marker as inflow and others as outflow", async () => {
    const user = userEvent.setup();
    render(<SourceWizard onSave={async () => {}} onCancel={() => {}} />);
    await user.upload(
      screen.getByLabelText("Example CSV file"),
      new File([CSV], "ex.csv", { type: "text/csv" }),
    );
    const table = await screen.findByRole("table", {
      name: "Transaction preview",
    });
    const amounts = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((r) => within(r).getAllByRole("cell").at(-1)?.textContent);
    // Without a marker the CR suffix is dropped: both amounts look positive.
    expect(amounts()).toEqual(["59.00", "113.83"]);

    await user.type(screen.getByLabelText("Credit marker"), "CR");
    expect(amounts()).toEqual(["-59.00", "113.83"]);

    await user.click(screen.getByLabelText("Flip amount"));
    expect(amounts()).toEqual(["59.00", "-113.83"]);
  });
});
