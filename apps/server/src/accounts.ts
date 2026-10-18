/** An Actual Budget account as returned by the API's `getAccounts()`. */
export interface Account {
  id: string;
  name: string;
}

/**
 * Lists the accounts available in Actual Budget. Placeholder data until the
 * Actual Budget connection exists.
 */
export function listAccounts(): Account[] {
  return [
    { id: "00000000-0000-4000-8000-000000000001", name: "Dummy Chequing" },
  ];
}
