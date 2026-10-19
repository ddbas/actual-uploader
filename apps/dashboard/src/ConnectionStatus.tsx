import { useEffect, useState } from "react";
import { type ActualStatus, fetchActualStatus } from "./api.js";

const POLL_MS = 30_000;

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
    setStatus(null);
    const check = () =>
      fetchActualStatus().then((s) => {
        if (active) setStatus(s);
      });
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
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
