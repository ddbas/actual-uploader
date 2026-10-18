import { describe, expect, it } from "vitest";
import {
  parseArgs,
  registerInIndex,
  renderBanner,
  renderCrawler,
} from "./generate-lib.js";

describe("parseArgs", () => {
  it("accepts valid args", () => {
    expect(parseArgs(["my-bank", "https://b.example/login"])).toEqual({
      ok: true,
      args: {
        name: "my-bank",
        url: "https://b.example/login",
        markerKey: "F9",
      },
    });
  });
  it("parses marker key", () => {
    const r = parseArgs(["a", "http://x.test", "--marker-key", "F8"]);
    expect(r.ok && r.args.markerKey).toBe("F8");
  });
  it.each([
    [["my-bank"]],
    [[]],
    [["My_Bank", "https://x.test"]],
    [["my-bank", "not a url"]],
    [["my-bank", "ftp://x.test"]],
    [["a", "https://x.test", "extra"]],
    [["a", "https://x.test", "--nope"]],
  ])("rejects %j", (argv) => {
    expect(parseArgs(argv).ok).toBe(false);
  });
});

describe("renderBanner", () => {
  it("names the configured marker key", () => {
    expect(renderBanner("F8")).toContain("F8");
    expect(renderBanner("F8")).not.toContain("F9");
  });
});

describe("renderCrawler", () => {
  it("emits a headed crawler with steps and a TODO", () => {
    const out = renderCrawler({
      name: "my-bank",
      url: "https://b.example/",
      steps: ["await page.goto('https://b.example/');", "await page.pause();"],
    });
    expect(out).toContain('id: "my-bank"');
    expect(out).toContain("headless: false");
    expect(out).toContain("export const myBankCrawler");
    expect(out).toContain("await page.pause();");
    expect(out).toContain("// TODO: extract transactions");
  });
});

describe("registerInIndex", () => {
  const index = `import { registerCrawler } from "crawler-core";
import { mockCrawler } from "./mock.js";

registerCrawler(mockCrawler);

export { mockCrawler };
`;
  it("registers once, idempotently", () => {
    const once = registerInIndex(index, "my-bank");
    expect(once).toContain('import { myBankCrawler } from "./my-bank.js";');
    expect(once).toContain("registerCrawler(myBankCrawler);");
    expect(once).toContain("export { mockCrawler, myBankCrawler };");
    expect(registerInIndex(once, "my-bank")).toBe(once);
  });
});
