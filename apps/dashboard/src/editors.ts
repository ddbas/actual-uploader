import type { ComponentType } from "react";
import type { ApproachId } from "statement-core";
import type { PdfDocument } from "statement-pdf";
import { AlignedColumnsEditor } from "./AlignedColumnsEditor.js";

/** What every approach's setup editor receives. */
export interface EditorProps {
  /** The example PDF, already read. */
  doc: PdfDocument;
  /** The approach's own configuration (opaque to the shell). */
  config: unknown;
  onChange: (config: unknown) => void;
}

/**
 * One setup editor per registered approach. Typed as a complete record, so
 * registering an approach in `statement-core` without an editor here fails
 * type-checking.
 */
export const EDITORS: Record<ApproachId, ComponentType<EditorProps>> = {
  "aligned-columns": AlignedColumnsEditor,
};
