import { describe, expect, it } from "vitest";
import { PAUSE_STATEMENT, sanitize } from "./sanitize.js";

describe("sanitize", () => {
  it("redacts English and French password fills with a warning", () => {
    const result = sanitize([
      "await page.goto('https://x.test/');",
      "await page.getByLabel('Password').fill('p1');",
      "await page.getByLabel('Mot de passe').fill('p2');",
      "await page.getByLabel('NIP').fill('p3');",
      "await page.locator('#passwd').fill('p4');",
      "await page.getByLabel('Name').fill('visible');",
    ]);
    expect(result.steps).toEqual([
      "await page.goto('https://x.test/');",
      PAUSE_STATEMENT,
      "await page.getByLabel('Name').fill('visible');",
    ]);
    expect(result.warnings).toHaveLength(4);
    expect(result.steps.join("")).not.toMatch(/p[1-4]'/);
  });

  it("leaves other steps untouched", () => {
    const steps = [
      "await page.goto('https://x.test/');",
      "await page.getByRole('button', { name: 'Go' }).click();",
    ];
    expect(sanitize(steps).steps).toEqual(steps);
  });

  it("counts recorded steps excluding the initial goto", () => {
    expect(sanitize(["await page.goto('https://x.test/');"])).toMatchObject({
      recordedStepCount: 0,
    });
    expect(sanitize([]).steps).toEqual([]);
  });
});
