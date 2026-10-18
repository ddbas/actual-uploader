import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAUSE_STATEMENT, sanitize } from "./sanitize.js";

const fixture = readFileSync(
  new URL("./fixtures/recording.ts.txt", import.meta.url),
  "utf8",
);

const wrap = (...lines: string[]) =>
  [
    "(async () => {",
    "  const browser = await chromium.launch({ headless: false });",
    "  const context = await browser.newContext();",
    "  const page = await context.newPage();",
    ...lines.map((line) => `  ${line}`),
    "  // ---------------------",
    "  await context.close();",
    "})();",
  ].join("\n");

describe("sanitize", () => {
  it("replaces a marked span with a single pause", () => {
    const { steps } = sanitize(fixture);
    expect(steps).toEqual([
      "await page.goto('https://bank.example/login');",
      "await page.getByRole('link', { name: 'Accounts' }).click();",
      PAUSE_STATEMENT,
      "await page.getByRole('link', { name: 'Chequing' }).click({\n  button: 'right'\n});",
      PAUSE_STATEMENT,
      "await page.getByRole('button', { name: 'Export' }).click();",
    ]);
  });

  it("never emits typed values or the marker key", () => {
    const output = sanitize(fixture).steps.join("\n");
    for (const secret of [
      "alice-secret-user",
      "hunter2-secret",
      "motdepasse-secret",
      "Escape",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it("redacts English and French password fills outside markers with a warning", () => {
    const result = sanitize(
      wrap(
        "await page.getByLabel('Password').fill('p1');",
        "await page.getByLabel('Mot de passe').fill('p2');",
        "await page.getByLabel('NIP').fill('p3');",
        "await page.locator('#passwd').fill('p4');",
        "await page.getByLabel('Name').fill('visible');",
      ),
    );
    expect(result.steps).toEqual([
      PAUSE_STATEMENT,
      "await page.getByLabel('Name').fill('visible');",
    ]);
    expect(result.warnings).toHaveLength(4);
    expect(result.steps.join("")).not.toMatch(/p[1-4]'/);
  });

  it("treats an unmatched start marker as manual to the end, with a warning", () => {
    const result = sanitize(
      wrap(
        "await page.goto('https://x.test/');",
        "await page.locator('body').press('Escape');",
        "await page.getByLabel('Code').fill('123456');",
        "await page.getByRole('button').click();",
      ),
    );
    expect(result.steps).toEqual([
      "await page.goto('https://x.test/');",
      PAUSE_STATEMENT,
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  it("honors a custom marker key", () => {
    const result = sanitize(
      wrap(
        "await page.locator('body').press('Tab');",
        "await page.getByLabel('User').fill('bob');",
        "await page.locator('body').press('Tab');",
        "await page.getByRole('button').press('Escape');",
      ),
      { markerKey: "Tab" },
    );
    expect(result.steps).toEqual([
      PAUSE_STATEMENT,
      "await page.getByRole('button').press('Escape');",
    ]);
  });

  it("strips wrapper and launch boilerplate", () => {
    const output = sanitize(fixture).steps.join("\n");
    expect(output).not.toMatch(/chromium|newContext|newPage|context\.close/);
  });

  it("reports no recorded steps when only the initial goto exists", () => {
    const result = sanitize(wrap("await page.goto('https://x.test/');"));
    expect(result.recordedStepCount).toBe(0);
    expect(sanitize("").steps).toEqual([]);
  });
});
