import { useEffect, useState } from "react";
import { type ActualStatus, fetchActualStatus } from "./api.js";

const POLL_MS = 60_000;

const STATUS_CLASS = {
  checking: "status-neutral",
  connected: "status-success",
  disconnected: "status-error",
} as const;

/** Header indicator showing whether Actual Budget can be reached. */
export function ConnectionStatus({ refreshKey = 0 }: { refreshKey?: number }) {
  const [status, setStatus] = useState<ActualStatus | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey re-triggers the check
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let nextAllowed = 0;
    setStatus(null);
    const schedule = (delayMs: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delayMs);
    };
    const check = async () => {
      const s = await fetchActualStatus();
      if (!active) return;
      setStatus(s);
      const wait = Math.max(POLL_MS, (s.retryAfterSeconds ?? 0) * 1000);
      nextAllowed = Date.now() + wait;
      schedule(wait);
    };
    const tick = () => {
      // Paused while hidden; visibilitychange re-checks.
      if (document.hidden) return;
      void check();
    };
    const onVisible = () => {
      if (document.hidden) return;
      if (Date.now() >= nextAllowed) void check();
      else schedule(nextAllowed - Date.now());
    };
    void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshKey]);

  const state =
    status === null
      ? "checking"
      : status.connected
        ? "connected"
        : "disconnected";
  const label =
    state === "checking"
      ? "Checking…"
      : state === "connected"
        ? "Connected"
        : "Not connected";

  return (
    <div
      className="inline-flex items-center gap-2 text-sm"
      aria-live="polite"
      title={state === "disconnected" ? status?.error : undefined}
    >
      <span className="inline-grid *:[grid-area:1/1]" aria-hidden="true">
        {state === "connected" ? (
          <span className="status status-success motion-safe:animate-ping" />
        ) : null}
        <span className={`status ${STATUS_CLASS[state]}`} />
      </span>
      <span>{label}</span>
    </div>
  );
}
