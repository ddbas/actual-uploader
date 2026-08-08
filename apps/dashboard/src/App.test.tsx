import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  close() {
    this.closed = true;
  }
}

const CRAWLERS = [
  { id: "mock", name: "Desjardins (Mock)", description: "Mock crawler" },
  { id: "other", name: "Other Bank", description: "Another crawler" },
];

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/crawlers")) {
      return new Response(JSON.stringify(CRAWLERS), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 202 });
  });
}

function getSource(): MockEventSource {
  const source = MockEventSource.instances[0];
  if (!source) {
    throw new Error("Expected an EventSource instance to have been created");
  }
  return source;
}

function findRow(name: string): HTMLElement {
  const row = screen
    .getAllByRole("listitem")
    .find((el) => el.textContent?.includes(name));
  if (!row) {
    throw new Error(`Expected to find a row containing "${name}"`);
  }
  return row;
}

beforeEach(() => {
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  globalThis.fetch = mockFetch() as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("shows the Home tab selected by default, with Results hidden", async () => {
    render(<App />);

    await screen.findByText("Desjardins (Mock)");

    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("tab", { name: "Results" }),
    ).not.toBeInTheDocument();
  });

  it("lists all registered crawlers with a Run button and Run All above the list", async () => {
    render(<App />);

    await screen.findByText("Desjardins (Mock)");
    expect(screen.getByText("Other Bank")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run All" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Run" })).toHaveLength(2);
  });

  it("reveals the Results tab and populates it after the first crawler finishes", async () => {
    render(<App />);
    await screen.findByText("Desjardins (Mock)");

    const source = getSource();
    source.emit({ type: "crawler-started", crawlerId: "mock" });
    source.emit({
      type: "crawler-progress",
      crawlerId: "mock",
      state: "running",
    });
    source.emit({
      type: "transaction",
      crawlerId: "mock",
      crawlerName: "Desjardins (Mock)",
      transaction: {
        account: "acc",
        date: "2024-01-15",
        amount: -100,
        payee_name: "Store",
      },
    });
    source.emit({ type: "crawler-finished", crawlerId: "mock" });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Results" })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("tab", { name: "Results" }));

    expect(await screen.findByText("Store")).toBeInTheDocument();
  });

  it("running one crawler does not change another crawler's state", async () => {
    render(<App />);
    await screen.findByText("Desjardins (Mock)");

    const source = getSource();
    source.emit({
      type: "crawler-progress",
      crawlerId: "mock",
      state: "running",
    });

    await waitFor(() => {
      expect(findRow("Desjardins (Mock)").textContent).toContain("Running");
    });

    expect(findRow("Other Bank").textContent).toContain("Idle");
  });

  it("aggregates transactions from multiple crawler runs, e.g. Run All", async () => {
    render(<App />);
    await screen.findByText("Desjardins (Mock)");

    const source = getSource();
    source.emit({
      type: "transaction",
      crawlerId: "mock",
      crawlerName: "Desjardins (Mock)",
      transaction: {
        account: "acc",
        date: "2024-01-15",
        amount: -100,
        payee_name: "Store A",
      },
    });
    source.emit({ type: "crawler-finished", crawlerId: "mock" });
    source.emit({
      type: "transaction",
      crawlerId: "other",
      crawlerName: "Other Bank",
      transaction: {
        account: "acc",
        date: "2024-01-16",
        amount: -200,
        payee_name: "Store B",
      },
    });
    source.emit({ type: "crawler-finished", crawlerId: "other" });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Results" })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Results" }));

    expect(await screen.findByText("Store A")).toBeInTheDocument();
    expect(await screen.findByText("Store B")).toBeInTheDocument();
  });
});
