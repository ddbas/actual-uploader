/**
 * Minimal `Transaction` shape mirrored from `crawler-core`, matching the
 * Actual Budget API reference. Duplicated here (rather than depending on
 * `crawler-core` at runtime) to keep the browser bundle free of any
 * server/Node-only code.
 */
export interface Transaction {
  id?: string;
  account: string;
  date: string;
  amount?: number;
  payee?: string;
  payee_name?: string;
  imported_payee?: string;
  category?: string;
  notes?: string;
  imported_id?: string;
  transfer_id?: string;
  cleared?: boolean;
  subtransactions?: Transaction[];
}
