import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { processCsv, type SourceDraft, validateSource } from "statement-core";
import {
  type ActualClient,
  createActualClient,
  type ImportTransaction,
} from "./actualClient.js";
import { ActualSettingsStore } from "./actualSettingsStore.js";
import { SourceStore } from "./sourceStore.js";

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
  /** Directory containing the built dashboard's static assets, if any. */
  staticDir?: string;
  /** Source storage. Defaults to a non-persistent in-memory store. */
  sources?: SourceStore;
  /** Actual settings storage. Defaults to a non-persistent in-memory store. */
  actualSettings?: ActualSettingsStore;
  /** Actual Budget client. Defaults to the real one using `actualSettings`. */
  actualClient?: ActualClient;
  /** Cache directory for the real Actual client's budget downloads. */
  actualDataDir?: string;
}

export interface AccountCrawlerServer {
  server: Server;
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
 * Creates the local HTTP server: a small REST API for sources and statement
 * processing, and (in production) static hosting of the built dashboard.
 */
export function createServer(
  options: CreateServerOptions,
): AccountCrawlerServer {
  const sources = options.sources ?? new SourceStore();
  const actualSettings = options.actualSettings ?? new ActualSettingsStore();
  const actualClient =
    options.actualClient ??
    createActualClient({
      getSettings: () => actualSettings.getSecret(),
      dataDir:
        options.actualDataDir ?? join(tmpdir(), "account-crawler-actual"),
    });

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname.startsWith("/api/sources")) {
      handleSources(req, res, url.pathname, sources).catch(() => {
        sendJson(res, 500, { error: "Internal error" });
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/accounts") {
      actualClient
        .listAccounts()
        .then((accounts) => sendJson(res, 200, accounts))
        .catch((error) => sendJson(res, 502, { error: errorMessage(error) }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/actual/status") {
      actualClient
        .getStatus()
        .then((status) => sendJson(res, 200, status))
        .catch((error) =>
          sendJson(res, 200, {
            connected: false,
            error: errorMessage(error),
          }),
        );
      return;
    }

    if (url.pathname === "/api/actual/import") {
      handleImport(req, res, actualClient).catch(() => {
        sendJson(res, 500, { error: "Internal error" });
      });
      return;
    }

    if (url.pathname === "/api/settings/actual") {
      handleActualSettings(req, res, actualSettings).catch(() => {
        sendJson(res, 500, { error: "Internal error" });
      });
      return;
    }

    if (req.method === "GET" && options.staticDir) {
      if (serveStatic(options.staticDir, url.pathname, res)) {
        return;
      }
    }

    sendJson(res, 404, { error: "Not found" });
  });

  return { server };
}

async function handleSources(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  pathname: string,
  store: SourceStore,
): Promise<void> {
  if (pathname === "/api/sources") {
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
      const errors = validateSource(body);
      if (errors.length > 0) {
        sendJson(res, 400, { errors });
        return;
      }
      const { id: _ignored, ...draft } = body as SourceDraft & {
        id?: string;
      };
      sendJson(res, 201, store.add(draft));
      return;
    }
  }

  const match = pathname.match(/^\/api\/sources\/([^/]+)(\/process)?$/);
  if (match) {
    const id = decodeURIComponent(match[1] ?? "");
    if (!match[2] && req.method === "DELETE") {
      if (store.remove(id)) {
        sendJson(res, 200, { deleted: id });
      } else {
        sendJson(res, 404, { error: `No source "${id}"` });
      }
      return;
    }
    if (match[2] && req.method === "POST") {
      const type = store.get(id);
      if (!type) {
        sendJson(res, 404, { error: `No source "${id}"` });
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

async function handleActualSettings(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  store: ActualSettingsStore,
): Promise<void> {
  if (req.method === "GET") {
    sendJson(res, 200, store.get());
    return;
  }
  if (req.method === "PUT") {
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { errors: { body: "Body must be valid JSON" } });
      return;
    }
    const errors = store.update(body);
    if (Object.keys(errors).length > 0) {
      sendJson(res, 400, { errors });
      return;
    }
    sendJson(res, 200, store.get());
    return;
  }
  sendJson(res, 405, { error: "Method not allowed" });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function handleImport(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  client: ActualClient,
): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  let body: { transactions?: unknown };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "Body must be valid JSON" });
    return;
  }
  const txs = body?.transactions;
  if (
    !Array.isArray(txs) ||
    txs.length === 0 ||
    !txs.every(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof t.account === "string" &&
        t.account !== "" &&
        typeof t.date === "string",
    )
  ) {
    sendJson(res, 400, {
      error:
        'Body must include a non-empty "transactions" array, each with string "account" and "date"',
    });
    return;
  }
  try {
    sendJson(
      res,
      200,
      await client.importTransactions(txs as ImportTransaction[]),
    );
  } catch (error) {
    sendJson(res, 502, { error: errorMessage(error) });
  }
}
