import type { PdfDocument } from "statement-pdf";

/**
 * Reads a PDF in the browser. pdfjs is large, so it is only loaded when a PDF
 * source is being set up.
 */
export async function loadPdf(bytes: ArrayBuffer): Promise<PdfDocument> {
  const [{ openPdf, setPdfWorkerSrc }, worker] = await Promise.all([
    import("statement-pdf"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  setPdfWorkerSrc(worker.default);
  return openPdf(bytes);
}

/** A user-facing explanation for a PDF that could not be read. */
export function describePdfError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "no-text") {
    return "This PDF has no readable text. Scanned PDFs are not supported.";
  }
  if (code === "encrypted") {
    return "This PDF is password-protected and cannot be read.";
  }
  return "This file could not be read as a PDF.";
}
