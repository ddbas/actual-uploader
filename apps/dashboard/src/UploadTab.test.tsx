import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadTab } from "./UploadTab.js";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/process")) {
        return new Response(
          JSON.stringify({
            transactions: [
              {
                account: "Chequing",
                date: "2024-01-05",
                amount: -450,
                payee_name: "Coffee",
              },
            ],
            errors: [{ row: 3, message: "Invalid date" }],
          }),
        );
      }
      if (String(url).endsWith("/api/accounts")) {
        return new Response(
          JSON.stringify([{ id: "acc-1", name: "Chequing" }]),
        );
      }
      return new Response(
        JSON.stringify([{ id: "s1", name: "Desjardins", format: "csv" }]),
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UploadTab", () => {
  it("processes files, shows results, and confirms the upload", async () => {
    const user = userEvent.setup();
    render(<UploadTab />);
    await user.selectOptions(await screen.findByLabelText("Source"), "s1");
    await user.selectOptions(screen.getByLabelText("Account"), "acc-1");
    await user.upload(
      screen.getByLabelText("Statement files"),
      new File(["x"], "a.csv", { type: "text/csv" }),
    );
    await user.click(screen.getByRole("button", { name: "Process files" }));

    expect(await screen.findByText("Coffee")).toBeTruthy();
    expect(screen.getByText("-4.50")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Invalid date");

    await user.click(screen.getByRole("button", { name: "Upload to Actual" }));
    expect((await screen.findByRole("status")).textContent).toContain(
      "Uploaded 1 transaction to Actual Budget",
    );
  });

  it("points to the Sources tab when there are no sources", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("[]"),
    );
    render(<UploadTab />);
    expect(await screen.findByText(/No sources yet/)).toBeTruthy();
  });
});
