import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActualSettingsPage } from "./ActualSettingsPage.js";

const noLocks = {
  serverUrl: false,
  serverPassword: false,
  syncId: false,
  encryptionPassword: false,
};
let puts: Record<string, unknown>[];
let current: Record<string, unknown>;

beforeEach(() => {
  puts = [];
  current = {
    serverUrl: "",
    syncId: "",
    hasServerPassword: false,
    hasEncryptionPassword: false,
    locked: noLocks,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        puts.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify(current), { status: 200 });
      }
      return new Response(JSON.stringify(current));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ActualSettingsPage", () => {
  it("saves valid settings with a masked password field", async () => {
    render(<ActualSettingsPage />);
    const pw = screen.getByLabelText(/Server password/);
    expect(pw).toHaveAttribute("type", "password");
    await userEvent.type(screen.getByLabelText(/Server URL/), "http://a.b");
    await userEvent.type(pw, "secret");
    await userEvent.type(screen.getByLabelText(/Sync ID/), "sid");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Settings saved.")).toBeTruthy();
    expect(puts).toEqual([
      { serverUrl: "http://a.b", syncId: "sid", serverPassword: "secret" },
    ]);
  });

  it("shows required-field errors and does not save", async () => {
    render(<ActualSettingsPage />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Server URL is required")).toBeTruthy();
    expect(screen.getByText("Server password is required")).toBeTruthy();
    expect(screen.getByText("Sync ID is required")).toBeTruthy();
    expect(puts).toHaveLength(0);
  });

  it("rejects an invalid URL", async () => {
    render(<ActualSettingsPage />);
    await userEvent.type(screen.getByLabelText(/Server URL/), "ftp://x");
    await userEvent.type(screen.getByLabelText(/Server password/), "p");
    await userEvent.type(screen.getByLabelText(/Sync ID/), "s");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/http or https/)).toBeTruthy();
    expect(puts).toHaveLength(0);
  });

  it("pre-fills and keeps existing passwords when untouched", async () => {
    current = {
      serverUrl: "https://x.y",
      syncId: "abc",
      hasServerPassword: true,
      hasEncryptionPassword: false,
      locked: noLocks,
    };
    render(<ActualSettingsPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Server URL/)).toHaveValue("https://x.y"),
    );
    expect(screen.getByLabelText(/Server password/)).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Settings saved.");
    expect(puts).toEqual([{ serverUrl: "https://x.y", syncId: "abc" }]);
  });

  it("locks env-provided fields and omits them from the PUT", async () => {
    current = {
      serverUrl: "https://env.example",
      syncId: "env-sync",
      hasServerPassword: false,
      hasEncryptionPassword: false,
      locked: { ...noLocks, serverUrl: true, syncId: true },
    };
    render(<ActualSettingsPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Server URL/)).toHaveValue(
        "https://env.example",
      ),
    );
    expect(screen.getByLabelText(/Server URL/)).toBeDisabled();
    expect(screen.getByLabelText(/Sync ID/)).toBeDisabled();
    expect(screen.getByLabelText(/Server password/)).toBeEnabled();
    expect(screen.getAllByText("Set by environment")).toHaveLength(2);
    await userEvent.type(screen.getByLabelText(/Server password/), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Settings saved.");
    expect(puts).toEqual([{ serverPassword: "pw" }]);
  });

  it("disables Save when everything is locked", async () => {
    current = {
      serverUrl: "https://env.example",
      syncId: "s",
      hasServerPassword: true,
      hasEncryptionPassword: true,
      locked: {
        serverUrl: true,
        serverPassword: true,
        syncId: true,
        encryptionPassword: true,
      },
    };
    render(<ActualSettingsPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
    );
    expect(screen.getByLabelText(/Server password/)).toHaveValue("");
  });
});
