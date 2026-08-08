import { useEffect, useRef, useState } from "react";
import type {
  CrawlerState,
  ResultTransaction,
  ServerEvent,
} from "./serverTypes.js";

const RECONNECT_DELAY_MS = 1000;

export interface UseCrawlerEventsResult {
  states: Record<string, CrawlerState>;
  errors: Record<string, string>;
  results: ResultTransaction[];
  hasAnyCompleted: boolean;
}

/**
 * Connects to the server's SSE endpoint, tracks each crawler's live state,
 * accumulates streamed transactions, and reconnects automatically if the
 * connection drops.
 */
export function useCrawlerEvents(): UseCrawlerEventsResult {
  const [states, setStates] = useState<Record<string, CrawlerState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ResultTransaction[]>([]);
  const [hasAnyCompleted, setHasAnyCompleted] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function handleEvent(event: ServerEvent): void {
      switch (event.type) {
        case "state-snapshot":
          setStates(event.states);
          break;
        case "crawler-progress":
          setStates((prev) => ({ ...prev, [event.crawlerId]: event.state }));
          break;
        case "crawler-finished":
          setHasAnyCompleted(true);
          break;
        case "crawler-failed":
          setErrors((prev) => ({ ...prev, [event.crawlerId]: event.error }));
          break;
        case "transaction":
          setResults((prev) => [
            ...prev,
            {
              ...event.transaction,
              crawlerId: event.crawlerId,
              crawlerName: event.crawlerName,
            },
          ]);
          break;
        default:
          break;
      }
    }

    function connect(): void {
      if (cancelledRef.current) return;
      source = new EventSource("/api/events");
      source.onmessage = (message) => {
        try {
          handleEvent(JSON.parse(message.data));
        } catch {
          // ignore malformed events
        }
      };
      source.onerror = () => {
        source?.close();
        if (!cancelledRef.current) {
          retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      cancelledRef.current = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return { states, errors, results, hasAnyCompleted };
}
