/**
 * Records a browsing session using Playwright's recorder, in a browser we
 * launch ourselves so that (a) it uses the same low-detectability launch
 * options as generated crawlers and (b) we can inject a floating "manual
 * mode" toggle button, whose recorded click acts as the pause marker.
 *
 * NOTE: `BrowserContext._enableRecorder` is a private Playwright API (it is
 * what `playwright codegen` itself uses). The `playwright` version is pinned
 * in the lockfile; `sanitize()` fails loudly if the output format changes.
 */
import type { BrowserContext, Page } from "playwright";
import { launchBrowser } from "../src/browser.js";
import { MANUAL_TOGGLE_TOKEN } from "./sanitize.js";

type RecorderContext = BrowserContext & {
  _enableRecorder(params: Record<string, unknown>): Promise<void>;
};

/**
 * Init script run in every page: renders the toggle button inside a shadow
 * root. Kept as a plain string because bundlers inject helpers (e.g.
 * `__name`) into serialized functions that do not exist in the page.
 */
const toggleButtonScript = (token: string) => `(() => {
  if (window !== window.top) return;
  const token = ${JSON.stringify(token)};
  const install = async () => {
    if (document.getElementById(token + "-host")) return;
    const host = document.createElement("div");
    host.id = token + "-host";
    host.style.cssText =
      "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    button.id = token;
    button.setAttribute("aria-label", token);
    button.style.cssText =
      "font:600 14px system-ui,sans-serif;color:#fff;border:0;border-radius:8px;padding:12px 16px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4)";
    const render = (manual) => {
      button.textContent = manual
        ? "\\u23F8 MANUAL MODE ON \\u2014 click when done"
        : "\\u25CF Recording \\u2014 click to start manual mode";
      button.style.background = manual ? "#c62828" : "#2e7d32";
    };
    render(await window.__crawlerGetState());
    button.addEventListener("click", async () => {
      render(await window.__crawlerToggle());
    });
    window.addEventListener("crawler-manual-state", (event) => {
      render(event.detail);
    });
    root.appendChild(button);
    document.documentElement.appendChild(host);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();`;

export async function record(
  url: string,
  outputFile: string,
  /** Test hook: drives the page instead of waiting for a human. */
  drive?: (page: Page) => Promise<void>,
): Promise<void> {
  const browser = await launchBrowser();
  const context = (await browser.newContext()) as RecorderContext;

  let manual = false;
  const pages = new Set<Page>();
  const broadcast = async () => {
    await Promise.all(
      [...pages].map((page) =>
        page
          .evaluate(
            (state) =>
              window.dispatchEvent(
                new CustomEvent("crawler-manual-state", { detail: state }),
              ),
            manual,
          )
          .catch(() => {}),
      ),
    );
  };
  await context.exposeFunction("__crawlerGetState", () => manual);
  await context.exposeFunction("__crawlerToggle", async () => {
    manual = !manual;
    console.log(
      manual
        ? "Manual mode ON: nothing from here on is kept."
        : "Manual mode OFF: recording resumes.",
    );
    await broadcast();
    return manual;
  });
  await context.addInitScript(toggleButtonScript(MANUAL_TOGGLE_TOKEN));
  context.on("page", (page) => {
    pages.add(page);
    page.on("close", () => pages.delete(page));
  });

  const closed = new Promise<void>((resolve) => {
    browser.on("disconnected", () => resolve());
  });

  await context._enableRecorder({
    language: "javascript",
    launchOptions: { headless: false },
    contextOptions: {},
    mode: "recording",
    outputFile,
    handleSIGINT: false,
  });
  const page = await context.newPage();
  await page.goto(url);
  if (drive) {
    await drive(page);
    await browser.close();
  }
  await closed;
}
