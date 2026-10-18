/**
 * A financial transaction, modeled directly on the Actual Budget API
 * `Transaction` reference (https://actualbudget.org/docs/api/reference).
 *
 * Only `account` and `date` are required. Sources should populate as many of
 * the remaining fields as they can so results can be imported into Actual
 * Budget without further transformation.
 */
export interface Transaction {
  /** Actual Budget transaction id. Omit for new/imported transactions. */
  id?: string;
  /** Actual Budget account id. Required. */
  account: string;
  /** ISO date in `YYYY-MM-DD` format. Required. */
  date: string;
  /** Integer amount, no decimal places (Actual Budget uses cents). */
  amount?: number;
  /** Actual Budget payee id. */
  payee?: string;
  /** Human-readable payee name (used when `payee` id is not known). */
  payee_name?: string;
  /** Raw payee name as reported by the source (e.g. the bank). */
  imported_payee?: string;
  /** Actual Budget category id. */
  category?: string;
  notes?: string;
  /** Stable id from the source system, used for de-duplication on import. */
  imported_id?: string;
  transfer_id?: string;
  cleared?: boolean;
  subtransactions?: Transaction[];
}
