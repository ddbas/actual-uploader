import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsTab } from "./SettingsTab.js";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("settings")
        ? new Response(
            JSON.stringify({
              serverUrl: "",
              syncId: "",
              hasServerPassword: false,
              hasEncryptionPassword: false,
              locked: {
                serverUrl: false,
                serverPassword: false,
                syncId: false,
                encryptionPassword: false,
              },
            }),
          )
        : new Response("[]"),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SettingsTab", () => {
  it("selects Actual by default and switches pages", async () => {
    render(<SettingsTab />);
    expect(screen.getByRole("button", { name: "Actual" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByLabelText(/Server URL/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByRole("button", { name: "Sources" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText(/No sources yet/)).toBeTruthy();
  });
});
