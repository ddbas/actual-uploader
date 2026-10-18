import { type Browser, chromium, type LaunchOptions } from "playwright";

/**
 * Launch options that make the browser look less like an automated one. Bank
 * sites commonly deny access to sessions that advertise automation
 * (`navigator.webdriver`, the `--enable-automation` switch, headless UA).
 */
export const STEALTH_LAUNCH_OPTIONS: LaunchOptions = {
  headless: false,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
};

/**
 * Launches a headed browser, preferring the user's installed Google Chrome
 * (a real, fully-featured browser) and falling back to Playwright's Chromium.
 */
export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      ...STEALTH_LAUNCH_OPTIONS,
      channel: "chrome",
    });
  } catch {
    console.warn(
      "Google Chrome not found; falling back to Playwright's Chromium, which is more likely to be detected as automated.",
    );
    return await chromium.launch(STEALTH_LAUNCH_OPTIONS);
  }
}
