import { alignedColumns } from "./alignedColumns.js";
import type { Approach } from "./types.js";

/** Every available extraction approach, by identifier. */
export const APPROACHES = {
  "aligned-columns": alignedColumns,
} as const satisfies Record<string, Approach>;

export type ApproachId = keyof typeof APPROACHES;

export const APPROACH_IDS = Object.keys(APPROACHES) as ApproachId[];

export const DEFAULT_APPROACH: ApproachId = "aligned-columns";

export function getApproach(id: string): Approach | undefined {
  return Object.hasOwn(APPROACHES, id)
    ? (APPROACHES as Record<string, Approach>)[id]
    : undefined;
}
