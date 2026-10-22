import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfPageItems, TextItem } from "statement-core";

export type PdfReadErrorCode = "not-pdf" | "encrypted" | "no-text";

/** A PDF that could not be read; `code` says why. */
export class PdfReadError extends Error {
  constructor(
    public readonly code: PdfReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfReadError";
  }
}

export interface OpenPdfOptions {
  /** Directory (with trailing slash) of pdfjs' standard font data. */
  standardFontDataUrl?: string;
}

export interface PdfDocument {
  /** Page sizes and positioned text, in PDF points (origin bottom-left). */
  pages: PdfPageItems[];
  /** Draws a 1-based page onto a canvas at the given scale (CSS px / point). */
  renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<void>;
  destroy(): Promise<void>;
}

/** Browsers must say where pdfjs' worker script is served from. */
export function setPdfWorkerSrc(url: string): void {
  pdfjs.GlobalWorkerOptions.workerSrc = url;
}

const isNode = typeof process !== "undefined" && !!process.versions?.node;

/** Where pdfjs' font data lives in `node_modules` (Node only). */
function nodeFontDataUrl(): string | undefined {
  if (!isNode) return undefined;
  try {
    // Looked up at runtime so browser bundles never see a Node import.
    const { createRequire } = process.getBuiltinModule("node:module");
    const pkg = createRequire(import.meta.url).resolve(
      "pdfjs-dist/package.json",
    );
    return `${pkg.slice(0, pkg.lastIndexOf("/"))}/standard_fonts/`;
  } catch {
    return undefined;
  }
}

function nameOf(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

/** Reads a PDF's pages and text. Throws `PdfReadError` for unusable files. */
export async function openPdf(
  bytes: Uint8Array | ArrayBuffer,
  options: OpenPdfOptions = {},
): Promise<PdfDocument> {
  // pdfjs takes ownership of the buffer it is given, so hand it a copy.
  const data =
    bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes.slice(0))
      : new Uint8Array(bytes);
  const task = pdfjs.getDocument({
    data,
    standardFontDataUrl: options.standardFontDataUrl ?? nodeFontDataUrl(),
    useSystemFonts: false,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => {});
    if (nameOf(error) === "PasswordException") {
      throw new PdfReadError(
        "encrypted",
        "The PDF is password-protected and cannot be read",
      );
    }
    throw new PdfReadError("not-pdf", "The file is not a readable PDF");
  }

  const pages: PdfPageItems[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view;
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of content.items) {
        if (!("str" in raw) || raw.str.trim() === "") continue;
        const [, , c, d, e, f] = raw.transform as number[];
        items.push({
          text: raw.str,
          x: (e ?? 0) - x0,
          y: (f ?? 0) - y0,
          width: raw.width,
          height: raw.height || Math.hypot(c ?? 0, d ?? 0),
        });
      }
      pages.push({ width: x1 - x0, height: y1 - y0, items });
    }
  } catch (error) {
    await doc.destroy();
    throw error instanceof PdfReadError
      ? error
      : new PdfReadError("not-pdf", "The file is not a readable PDF");
  }

  if (pages.every((p) => p.items.length === 0)) {
    await doc.destroy();
    throw new PdfReadError(
      "no-text",
      "The PDF has no readable text (scanned PDFs are not supported)",
    );
  }

  return {
    pages,
    async renderPage(pageNumber, canvas, scale) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
    },
    destroy: () => doc.destroy(),
  };
}

/** Convenience for the server: bytes to pages of positioned text items. */
export async function readPdfPages(
  bytes: Uint8Array | ArrayBuffer,
  options?: OpenPdfOptions,
): Promise<PdfPageItems[]> {
  const doc = await openPdf(bytes, options);
  try {
    return doc.pages;
  } finally {
    await doc.destroy();
  }
}
