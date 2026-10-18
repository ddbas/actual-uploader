/**
 * Records a browsing session using only public Playwright APIs: a browser we
 * launch ourselves, an init script (`scripts/recorder-page.js`) that observes
 * real user events, and `exposeFunction` to report them. Statements are
 * generated here; nothing typed during a manual section ever leaves the page.
 */
import { readFileSync } from "node:fs";
import type { Browser, Page } from "playwright";
import { launchBrowser } from "../src/browser.js";
import { PAUSE_STATEMENT } from "./sanitize.js";

const RECORDER_SCRIPT = readFileSync(
  new URL("./recorder-page.js", import.meta.url),
  "utf8",
);

export interface RecordedEvent {
  action:
    | "click"
    | "check"
    | "uncheck"
    | "fill"
    | "select"
    | "press"
    | "secret";
  locator: string;
  value?: string;
}

export interface RecordOptions {
  /** Test hooks: supply a browser and/or drive the page instead of a human. */
  launch?: () => Promise<Browser>;
  drive?: (page: Page) => Promise<void>;
}

export interface RecordResult {
  statements: string[];
  /** Number of password-like entries replaced by a pause. */
  secretsRedacted: number;
  endedInManual: boolean;
}

export function toStatement(event: RecordedEvent): string | undefined {
  const target = `page.${event.locator}`;
  switch (event.action) {
    case "click":
      return `await ${target}.click();`;
    case "check":
      return `await ${target}.check();`;
    case "uncheck":
      return `await ${target}.uncheck();`;
    case "fill":
      return `await ${target}.fill(${JSON.stringify(event.value ?? "")});`;
    case "select":
      return `await ${target}.selectOption(${JSON.stringify(event.value ?? "")});`;
    case "press":
      return `await ${target}.press(${JSON.stringify(event.value ?? "")});`;
    case "secret":
      return PAUSE_STATEMENT;
  }
}

export async function record(
  url: string,
  options: RecordOptions = {},
): Promise<RecordResult> {
  const browser = await (options.launch ?? launchBrowser)();
  const context = await browser.newContext();

  const statements = [`await page.goto(${JSON.stringify(url)});`];
  let manual = false;
  let secretsRedacted = 0;
  const pages = new Set<Page>();

  const push = (statement: string) => {
    if (
      statement === PAUSE_STATEMENT &&
      statements.at(-1) === PAUSE_STATEMENT
    ) {
      return;
    }
    statements.push(statement);
  };

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
    if (manual) {
      push(PAUSE_STATEMENT);
      console.log("Manual mode ON: nothing from here on is kept.");
    } else {
      console.log("Manual mode OFF: recording resumes.");
    }
    await broadcast();
    return manual;
  });
  await context.exposeFunction("__crawlerEmit", (event: RecordedEvent) => {
    if (manual) {
      return;
    }
    if (event.action === "secret") {
      secretsRedacted += 1;
    }
    const statement = toStatement(event);
    if (statement) {
      push(statement);
    }
  });
  await context.addInitScript(RECORDER_SCRIPT);

  const closed = new Promise<void>((resolve) => {
    browser.on("disconnected", () => resolve());
  });
  context.on("page", (page) => {
    pages.add(page);
    page.on("close", () => {
      pages.delete(page);
      if (pages.size === 0) {
        browser.close().catch(() => {});
      }
    });
  });

  const page = await context.newPage();
  await page.goto(url);
  if (options.drive) {
    await options.drive(page);
    await page.close();
  }
  await closed;

  return { statements, secretsRedacted, endedInManual: manual };
}
