import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadTab } from "./UploadTab.js";

type FetchFn = (
  url: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

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
      if (String(url).endsWith("/api/actual/import")) {
        return new Response(JSON.stringify({ added: 1, updated: 0 }));
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

  async function toReview(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(await screen.findByLabelText("Source"), "s1");
    await user.selectOptions(screen.getByLabelText("Account"), "acc-1");
    await user.upload(
      screen.getByLabelText("Statement files"),
      new File(["x"], "a.csv", { type: "text/csv" }),
    );
    await user.click(screen.getByRole("button", { name: "Process files" }));
    await screen.findByText("Coffee");
  }

  it("shows the error and keeps the review when the upload fails", async () => {
    const user = userEvent.setup();
    const base = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).getMockImplementation();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: RequestInfo | URL, init?: RequestInit) =>
        String(url).endsWith("/api/actual/import")
          ? new Response(JSON.stringify({ error: "Not connected" }), {
              status: 502,
            })
          : (base as FetchFn)(url, init),
    );
    render(<UploadTab />);
    await toReview(user);
    await user.click(screen.getByRole("button", { name: "Upload to Actual" }));
    expect(await screen.findByText("Not connected")).toBeTruthy();
    expect(screen.getByText("Coffee")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Upload to Actual" }),
    ).toBeEnabled();
  });

  it("disables the button while uploading", async () => {
    const user = userEvent.setup();
    const base = (
      fetch as unknown as ReturnType<typeof vi.fn>
    ).getMockImplementation();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: RequestInfo | URL, init?: RequestInit) =>
        String(url).endsWith("/api/actual/import")
          ? new Promise(() => {})
          : (base as FetchFn)(url, init),
    );
    render(<UploadTab />);
    await toReview(user);
    await user.click(screen.getByRole("button", { name: "Upload to Actual" }));
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
  });

  it("points to the Sources tab when there are no sources", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("[]"),
    );
    render(<UploadTab />);
    expect(await screen.findByText(/No sources yet/)).toBeTruthy();
  });
});

describe("UploadTab with PDF sources", () => {
  let processBodies: unknown[];
  let processResponse: () => Response;

  beforeEach(() => {
    processBodies = [];
    processResponse = () =>
      new Response(
        JSON.stringify({
          transactions: [
            { account: "acc-1", date: "2026-01-05", amount: -450 },
          ],
          errors: [],
          warnings: [],
        }),
      );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).endsWith("/process")) {
          processBodies.push(JSON.parse(init?.body as string));
          return processResponse();
        }
        if (String(url).endsWith("/api/accounts")) {
          return new Response(
            JSON.stringify([{ id: "acc-1", name: "Chequing" }]),
          );
        }
        return new Response(
          JSON.stringify([
            { id: "csv", name: "Bank CSV", format: "csv" },
            { id: "pdf", name: "Card PDF", format: "pdf" },
          ]),
        );
      }),
    );
  });

  async function choosePdf(
    user: ReturnType<typeof userEvent.setup>,
    ...files: File[]
  ) {
    await user.selectOptions(await screen.findByLabelText("Source"), "pdf");
    await user.selectOptions(screen.getByLabelText("Account"), "acc-1");
    await user.upload(screen.getByLabelText("Statement files"), files);
    await user.click(screen.getByRole("button", { name: "Process files" }));
  }
  const pdf = (name = "a.pdf") =>
    new File(["%PDF-1.4 hello"], name, { type: "application/pdf" });

  it("accepts PDFs and sends them as base64", async () => {
    const user = userEvent.setup();
    render(<UploadTab />);
    await user.selectOptions(await screen.findByLabelText("Source"), "pdf");
    expect(
      (screen.getByLabelText("Statement files") as HTMLInputElement).accept,
    ).toContain(".pdf");
    await user.selectOptions(await screen.findByLabelText("Source"), "csv");
    expect(
      (screen.getByLabelText("Statement files") as HTMLInputElement).accept,
    ).toContain(".csv");

    await choosePdf(user, pdf());
    expect(await screen.findByText("2026-01-05")).toBeTruthy();
    expect(processBodies).toEqual([
      {
        account: "acc-1",
        contentBase64: btoa("%PDF-1.4 hello"),
      },
    ]);
  });

  it("shows warnings with the file's results", async () => {
    processResponse = () =>
      new Response(
        JSON.stringify({
          transactions: [],
          errors: [],
          warnings: ["No transactions found: no line has a date"],
        }),
      );
    const user = userEvent.setup();
    render(<UploadTab />);
    await choosePdf(user, pdf());
    expect(
      (await screen.findByText(/a\.pdf: No transactions found/)).textContent,
    ).toContain("no line has a date");
    expect(
      (
        screen.getByRole("button", {
          name: "Upload to Actual",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("names the reason an unreadable PDF failed, per file", async () => {
    let calls = 0;
    const ok = processResponse;
    processResponse = () =>
      ++calls === 1
        ? new Response(
            JSON.stringify({ error: "The PDF is password-protected" }),
            { status: 400 },
          )
        : ok();
    const user = userEvent.setup();
    render(<UploadTab />);
    await choosePdf(user, pdf("locked.pdf"), pdf("fine.pdf"));
    expect(
      (await screen.findByText(/locked\.pdf: The PDF is password-protected/))
        .textContent,
    ).toBeTruthy();
    expect(screen.getByText("2026-01-05")).toBeTruthy();
  });
});
