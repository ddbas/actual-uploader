import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "./ConnectionStatus.js";

function stubStatus(body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ConnectionStatus", () => {
  it("shows checking, then a pulsing connected state", async () => {
    stubStatus({ connected: true });
    const { container } = render(<ConnectionStatus />);
    expect(screen.getByText("Checking…")).toBeTruthy();
    expect(await screen.findByText("Connected")).toBeTruthy();
    expect(container.querySelector(".status-dot.connected")).toBeTruthy();
  });

  it("shows not connected with the reason as a tooltip", async () => {
    stubStatus({ connected: false, error: "Wrong password" });
    const { container } = render(<ConnectionStatus />);
    expect(await screen.findByText("Not connected")).toBeTruthy();
    expect(container.querySelector(".status-dot.disconnected")).toBeTruthy();
    expect(container.querySelector("[title='Wrong password']")).toBeTruthy();
  });

  it("re-checks periodically and when refreshKey changes", async () => {
    vi.useFakeTimers();
    const fn = stubStatus({ connected: true });
    const { rerender } = render(<ConnectionStatus refreshKey={0} />);
    await act(async () => {});
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    rerender(<ConnectionStatus refreshKey={1} />);
    await act(async () => {});
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
