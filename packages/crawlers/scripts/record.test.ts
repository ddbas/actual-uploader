import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { record } from "./record.js";
import { sanitize } from "./sanitize.js";

const HTML = `<h1>Bank</h1>
<a href="#accounts">Accounts</a>
<label>Username <input name="u"></label>
<label>Password <input type="password" name="p"></label>
<button>Sign in</button>
<label><input type="checkbox"> Remember me</label>
<button>Export</button><button>Export</button>
<select aria-label="Period"><option value="a">A</option><option value="b">B</option></select>`;
const URL_ = `data:text/html,${encodeURIComponent(HTML)}`;

let available = true;
beforeAll(async () => {
  try {
    await (await chromium.launch()).close();
  } catch {
    available = false;
  }
});
afterAll(() => {});

const launch = (): Promise<Browser> => chromium.launch();
const settle = (page: Page) => page.waitForTimeout(250);

describe("record (real browser, public APIs only)", () => {
  it("records steps, drops manual sections and never captures typed secrets", async (ctx) => {
    if (!available) ctx.skip();
    const result = await record(URL_, {
      launch,
      drive: async (page) => {
        await page.getByRole("link", { name: "Accounts" }).click();
        await settle(page);
        await page.locator("#crawler-manual-toggle").click();
        await settle(page);
        await page.getByLabel("Username").fill("alice-secret");
        await page.getByLabel("Username").press("Tab");
        await page.getByLabel("Password").fill("hunter2-secret");
        await page.getByRole("button", { name: "Sign in" }).click();
        await settle(page);
        await page.locator("#crawler-manual-toggle").click();
        await settle(page);
        await page.getByLabel("Remember me").check();
        await settle(page);
        await page.getByRole("button", { name: "Export" }).nth(1).click();
        await settle(page);
      },
    });
    const text = result.statements.join("\n");
    expect(text).not.toContain("alice-secret");
    expect(text).not.toContain("hunter2-secret");
    expect(text).not.toContain("Sign in");
    expect(text).toContain(
      'getByRole("link", { name: "Accounts", exact: true })',
    );
    expect(text).toContain("await page.pause();");
    expect(text).toContain(
      'getByLabel("Remember me", { exact: true }).check()',
    );
    expect(text).toContain(
      'getByRole("button", { name: "Export", exact: true }).nth(1).click()',
    );
    expect(result.endedInManual).toBe(false);
    expect(sanitize(result.statements).recordedStepCount).toBeGreaterThan(3);
  }, 30000);

  it("redacts unmarked password input without capturing its value", async (ctx) => {
    if (!available) ctx.skip();
    const result = await record(URL_, {
      launch,
      drive: async (page) => {
        await page.getByLabel("Password").fill("topsecret");
        await page.getByLabel("Password").press("Tab");
        await settle(page);
      },
    });
    expect(result.statements.join("\n")).not.toContain("topsecret");
    expect(result.statements).toContain("await page.pause();");
    expect(result.secretsRedacted).toBe(1);
  }, 30000);

  it("reports an unterminated manual section", async (ctx) => {
    if (!available) ctx.skip();
    const result = await record(URL_, {
      launch,
      drive: async (page) => {
        await page.locator("#crawler-manual-toggle").click();
        await settle(page);
        await page.getByRole("button", { name: "Sign in" }).click();
        await settle(page);
      },
    });
    expect(result.endedInManual).toBe(true);
    expect(result.statements).toEqual([
      `await page.goto(${JSON.stringify(URL_)});`,
      "await page.pause();",
    ]);
  }, 30000);
});
