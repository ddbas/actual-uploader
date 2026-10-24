import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import {
  getApproach,
  type ProcessResult,
  processCsv,
  type SourceDraft,
  validateSource,
} from "statement-core";
import { PdfReadError, readPdfPages } from "statement-pdf";
import {
  type ActualClient,
  createActualClient,
  type ImportTransaction,
} from "./actualClient.js";
import { ActualSettingsStore } from "./actualSettingsStore.js";
import { type Logger, silentLogger } from "./logger.js";
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
  /** Logger. Defaults to a silent one. */
  logger?: Logger;
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
  const rootLogger = options.logger ?? silentLogger;
  const log = rootLogger.child({ component: "http" });
  const sources =
    options.sources ??
    new SourceStore(undefined, rootLogger.child({ component: "sources" }));
  const actualSettings =
    options.actualSettings ??
    new ActualSettingsStore(
      undefined,
      {},
      rootLogger.child({ component: "settings" }),
    );
  const actualClient =
    options.actualClient ??
    createActualClient({
      getSettings: () => actualSettings.getSecret(),
      dataDir:
        options.actualDataDir ?? join(tmpdir(), "account-crawler-actual"),
      logger: rootLogger.child({ component: "actual" }),
    });

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const started = Date.now();
    res.on("finish", () => {
      const status = res.statusCode;
      const entry = {
        method: req.method,
        path: url.pathname,
        status,
        durationMs: Date.now() - started,
      };
      // 502 is an Actual failure the client already logged as a warning.
      if (status === 502) log.warn(entry, "Upstream request failed");
      else if (status >= 500) log.error(entry, "Request failed");
      else if (status >= 400) log.warn(entry, "Request rejected");
      else if (url.pathname.startsWith("/api/") && req.method !== "GET")
        log.info(entry, "Request completed");
      else log.debug(entry, "Request completed");
    });
    const internalError = (route: string) => (error: unknown) => {
      log.error({ err: error, route }, "Unhandled error in request handler");
      if (!res.headersSent) sendJson(res, 500, { error: "Internal error" });
    };

    if (url.pathname.startsWith("/api/sources")) {
      handleSources(req, res, url.pathname, sources, log).catch(
        internalError("sources"),
      );
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
      handleImport(req, res, actualClient, log).catch(internalError("import"));
      return;
    }

    if (url.pathname === "/api/settings/actual") {
      handleActualSettings(req, res, actualSettings, log).catch(
        internalError("settings"),
      );
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
  log: Logger,
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
        log.warn({ errors }, "Source rejected: validation failed");
        sendJson(res, 400, { errors });
        return;
      }
      const { id: _ignored, ...draft } = body as SourceDraft & {
        id?: string;
      };
      const created = store.add(draft);
      log.info({ sourceId: created.id }, "Source created");
      sendJson(res, 201, created);
      return;
    }
  }

  const match = pathname.match(/^\/api\/sources\/([^/]+)(\/process)?$/);
  if (match) {
    const id = decodeURIComponent(match[1] ?? "");
    if (!match[2] && req.method === "DELETE") {
      if (store.remove(id)) {
        log.info({ sourceId: id }, "Source deleted");
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
      let body: {
        account?: unknown;
        content?: unknown;
        contentBase64?: unknown;
      };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        sendJson(res, 400, { error: "Body must be valid JSON" });
        return;
      }
      if (type.format === "pdf") {
        if (
          typeof body.account !== "string" ||
          typeof body.contentBase64 !== "string"
        ) {
          sendJson(res, 400, {
            error: 'Body must include string "account" and "contentBase64"',
          });
          return;
        }
        const approach = getApproach(type.approach);
        if (!approach) {
          sendJson(res, 400, {
            error: `Unknown extraction approach "${type.approach}"`,
          });
          return;
        }
        try {
          const pages = await readPdfPages(
            Buffer.from(body.contentBase64, "base64"),
          );
          const result: ProcessResult = approach.run(
            pages,
            type.config,
            body.account,
          );
          log.debug(
            { sourceId: id, format: "pdf", pages: pages.length },
            "Statement processed",
          );
          sendJson(res, 200, result);
        } catch (error) {
          if (error instanceof PdfReadError) {
            log.warn(
              { sourceId: id, code: error.code },
              "PDF could not be read",
            );
            sendJson(res, 400, { error: error.message, code: error.code });
            return;
          }
          throw error;
        }
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
      const processed = processCsv(type, body.content, body.account);
      log.debug({ sourceId: id, format: "csv" }, "Statement processed");
      sendJson(res, 200, processed);
      return;
    }
  }
  sendJson(res, 404, { error: "Not found" });
}

async function handleActualSettings(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  store: ActualSettingsStore,
  log: Logger,
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
      log.warn({ fields: Object.keys(errors) }, "Settings update rejected");
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
  log: Logger,
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
    log.warn("Import rejected: invalid transactions payload");
    sendJson(res, 400, {
      error:
        'Body must include a non-empty "transactions" array, each with string "account" and "date"',
    });
    return;
  }
  try {
    log.debug({ count: txs.length }, "Import requested");
    sendJson(
      res,
      200,
      await client.importTransactions(txs as ImportTransaction[]),
    );
  } catch (error) {
    sendJson(res, 502, { error: errorMessage(error) });
  }
}
