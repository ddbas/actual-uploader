import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { extname, join } from "node:path";
import type { Crawler } from "crawler-core";
import {
  processCsv,
  type UploadTypeDraft,
  validateUploadType,
} from "statement-core";
import { CrawlerRunner, type RunnerEvent } from "./runner.js";
import { UploadTypeStore } from "./uploadTypeStore.js";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

export interface CreateServerOptions {
  /** Crawlers available to run. Defaults to the registered crawler registry. */
  crawlers: Iterable<Crawler>;
  /** Directory containing the built dashboard's static assets, if any. */
  staticDir?: string;
  /** Upload type storage. Defaults to a non-persistent in-memory store. */
  uploadTypes?: UploadTypeStore;
}

export interface AccountCrawlerServer {
  server: Server;
  runner: CrawlerRunner;
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(
  staticDir: string,
  urlPath: string,
  res: import("node:http").ServerResponse,
): boolean {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  let filePath = join(staticDir, safePath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(staticDir, "index.html");
  }

  if (!existsSync(filePath)) {
    return false;
  }

  const contentType =
    CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
  return true;
}

/**
 * Creates the local HTTP server: a small REST API to list/run crawlers, an
 * SSE endpoint streaming crawler lifecycle/transaction events, and (in
 * production) static hosting of the built dashboard.
 */
export function createServer(
  options: CreateServerOptions,
): AccountCrawlerServer {
  const runner = new CrawlerRunner(options.crawlers);
  const uploadTypes = options.uploadTypes ?? new UploadTypeStore();
  const sseClients = new Set<import("node:http").ServerResponse>();

  const broadcast = (event: RunnerEvent): void => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  };
  runner.on("event", broadcast);

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname.startsWith("/api/upload-types")) {
      handleUploadTypes(req, res, url.pathname, uploadTypes).catch(() => {
        sendJson(res, 500, { error: "Internal error" });
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/crawlers") {
      sendJson(res, 200, runner.listCrawlers());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(
        `data: ${JSON.stringify({ type: "state-snapshot", states: runner.getStates() })}\n\n`,
      );
      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    const runOneMatch = url.pathname.match(/^\/api\/crawlers\/([^/]+)\/run$/);
    if (req.method === "POST" && runOneMatch) {
      const id = decodeURIComponent(runOneMatch[1] ?? "");
      if (!runner.hasCrawler(id)) {
        sendJson(res, 404, { error: `No crawler registered with id "${id}"` });
        return;
      }
      // Fire-and-forget: progress/results are delivered over SSE.
      void runner.runOne(id);
      sendJson(res, 202, { started: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/run-all") {
      void runner.runAll();
      sendJson(res, 202, { started: "all" });
      return;
    }

    if (req.method === "GET" && options.staticDir) {
      if (serveStatic(options.staticDir, url.pathname, res)) {
        return;
      }
    }

    sendJson(res, 404, { error: "Not found" });
  });

  server.on("close", () => {
    runner.off("event", broadcast);
    for (const client of sseClients) {
      client.end();
    }
    sseClients.clear();
  });

  return { server, runner };
}

async function handleUploadTypes(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  pathname: string,
  store: UploadTypeStore,
): Promise<void> {
  if (pathname === "/api/upload-types") {
    if (req.method === "GET") {
      sendJson(res, 200, store.list());
      return;
    }
    if (req.method === "POST") {
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        sendJson(res, 400, { errors: ["Body must be valid JSON"] });
        return;
      }
      const errors = validateUploadType(body);
      if (errors.length > 0) {
        sendJson(res, 400, { errors });
        return;
      }
      const { id: _ignored, ...draft } = body as UploadTypeDraft & {
        id?: string;
      };
      sendJson(res, 201, store.add(draft));
      return;
    }
  }

  const match = pathname.match(/^\/api\/upload-types\/([^/]+)(\/process)?$/);
  if (match) {
    const id = decodeURIComponent(match[1] ?? "");
    if (!match[2] && req.method === "DELETE") {
      if (store.remove(id)) {
        sendJson(res, 200, { deleted: id });
      } else {
        sendJson(res, 404, { error: `No upload type "${id}"` });
      }
      return;
    }
    if (match[2] && req.method === "POST") {
      const type = store.get(id);
      if (!type) {
        sendJson(res, 404, { error: `No upload type "${id}"` });
        return;
      }
      let body: { account?: unknown; content?: unknown };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        sendJson(res, 400, { error: "Body must be valid JSON" });
        return;
      }
      if (
        typeof body.account !== "string" ||
        typeof body.content !== "string"
      ) {
        sendJson(res, 400, {
          error: 'Body must include string "account" and "content"',
        });
        return;
      }
      sendJson(res, 200, processCsv(type, body.content, body.account));
      return;
    }
  }
  sendJson(res, 404, { error: "Not found" });
}
