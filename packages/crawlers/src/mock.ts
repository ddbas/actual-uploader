import type { Crawler, Transaction } from "crawler-core";
import { chromium } from "playwright";

export const MOCK_CRAWLER_URL =
  "https://accweb.mouv.desjardins.com/identifiantunique/securite-garantie/authentification/auth/manuel";

const MOCK_WAIT_MS = 5000;

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    account: "mock-account",
    date: "2024-01-15",
    amount: -4599,
    payee_name: "Grocery Store",
    imported_id: "mock-1",
    notes: "Sample transaction produced by the mock crawler.",
  },
  {
    account: "mock-account",
    date: "2024-01-16",
    amount: 250000,
    payee_name: "Employer Inc",
    imported_id: "mock-2",
    notes: "Sample transaction produced by the mock crawler.",
  },
];

/**
 * Reference implementation of the {@link Crawler} interface.
 *
 * Opens a real bank authentication page via Playwright to simulate a login
 * session (without attempting to authenticate), then yields a small set of
 * hard-coded transactions.
 */
export const mockCrawler: Crawler = {
  id: "mock",
  name: "Desjardins (Mock)",
  description:
    "Reference crawler that simulates a Desjardins login session and produces sample transactions.",
  async *run() {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(MOCK_CRAWLER_URL);
      await page.waitForTimeout(MOCK_WAIT_MS);
    } finally {
      await browser.close();
    }

    for (const transaction of MOCK_TRANSACTIONS) {
      yield transaction;
    }
  },
};
