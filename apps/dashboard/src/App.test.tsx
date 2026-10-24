import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows the Upload tab selected by default, with only Upload and Settings tabs", () => {
    render(<App />);

    expect(screen.getByRole("tab", { name: "Upload" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Sources" }),
    ).not.toBeInTheDocument();
  });

  it("shows the connection indicator in the header on every tab", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: RequestInfo | URL) =>
        new Response(
          String(url).endsWith("/api/actual/status")
            ? '{"connected":true}'
            : "[]",
        ),
    );
    render(<App />);
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("re-checks the connection after saving Actual settings", async () => {
    let connected = false;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        if (u.endsWith("/api/actual/status"))
          return new Response(JSON.stringify({ connected }));
        if (u.endsWith("/api/settings/actual")) {
          if (init?.method === "PUT") connected = true;
          return new Response(
            JSON.stringify({
              serverUrl: "http://x",
              syncId: "s",
              hasServerPassword: true,
              hasEncryptionPassword: false,
              locked: {
                serverUrl: false,
                serverPassword: false,
                syncId: false,
                encryptionPassword: false,
              },
            }),
          );
        }
        return new Response("[]");
      },
    );
    render(<App />);
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));
    await screen.findByDisplayValue("http://x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });

  it("switches to the Settings tab", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
