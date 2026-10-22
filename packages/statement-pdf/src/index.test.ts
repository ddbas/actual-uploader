import { afterEach, describe, expect, it, vi } from "vitest";
import { openPdf, PdfReadError, readPdfPages } from "./index.js";
import { buildPdf } from "./testing.js";

afterEach(() => vi.restoreAllMocks());

describe("readPdfPages", () => {
  it("returns page sizes and positioned text items", async () => {
    const warn = vi.spyOn(console, "warn");
    const pages = await readPdfPages(
      buildPdf([
        [
          { text: "03 09", x: 40, y: 700 },
          { text: "COFFEE", x: 130, y: 700 },
        ],
        [{ text: "Second page", x: 50, y: 600 }],
      ]),
    );
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ width: 612, height: 792 });
    const first = pages[0]?.items.find((i) => i.text.includes("COFFEE"));
    expect(first?.x).toBeCloseTo(130, 0);
    expect(first?.y).toBeCloseTo(700, 0);
    expect(first?.width).toBeGreaterThan(20);
    expect(first?.height).toBeGreaterThan(5);
    expect(pages[1]?.items[0]?.text).toBe("Second page");
    // standard font data is found, so pdfjs has nothing to warn about
    expect(
      warn.mock.calls.filter((c) =>
        String(c[0]).includes("standardFontDataUrl"),
      ),
    ).toEqual([]);
  });

  it("does not consume the caller's bytes", async () => {
    const bytes = buildPdf([[{ text: "x", x: 1, y: 1 }]]);
    await readPdfPages(bytes);
    expect((await readPdfPages(bytes))[0]?.items).toHaveLength(1);
  });

  it("rejects non-PDF content", async () => {
    await expect(
      readPdfPages(new TextEncoder().encode("hello")),
    ).rejects.toMatchObject({
      code: "not-pdf",
    });
  });

  it("rejects a PDF without text", async () => {
    const err = await readPdfPages(buildPdf([[]])).catch((e) => e);
    expect(err).toBeInstanceOf(PdfReadError);
    expect(err.code).toBe("no-text");
  });

  it("rejects an encrypted PDF", async () => {
    await expect(
      readPdfPages(buildPdf([[{ text: "x", x: 1, y: 1 }]], { encrypt: true })),
    ).rejects.toMatchObject({ code: "encrypted" });
  });
});

describe("openPdf", () => {
  it("exposes pages and can be destroyed", async () => {
    const doc = await openPdf(buildPdf([[{ text: "x", x: 1, y: 1 }]]));
    expect(doc.pages).toHaveLength(1);
    await doc.destroy();
  });
});
