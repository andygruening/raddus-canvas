#!/usr/bin/env node

import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { dirname, extname, join, resolve, sep } from "node:path";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const defaultPort = Number.parseInt(process.env.PORT ?? "5174", 10);
const isDev = process.argv.includes("--dev");
const sessionCookieName = "canvas_local_session";
const sessionMaxAgeSeconds = 12 * 60 * 60;
const maxBodyBytes = 2 * 1024 * 1024;
const localUserId = "local-anthropic-user";
const localUserEmail = "Local Anthropic key";
const sessions = new Map();
const localStoreNames = new Set(["projects", "mcpServers"]);
const localDataFile = resolveLocalDataFile();
const keychainService = "Raddus Canvas Anthropic API Key";
const keychainAccount = localUserId;
let memoryApiKey = null;
let localDataWriteQueue = Promise.resolve();
const appDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(appDir, "dist");
const bareAnthropicRoutes = new Set(["agents", "deployments", "environments", "messages", "sessions", "skills", "vaults"]);
const bareLocalRoutes = new Set(["api-keys", "chat", "integrations", "mcp-servers", "package-presets", "projects", "tutorials", "users"]);

let vite = null;
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    appType: "spa",
    server: {
      hmr: { host, protocol: "ws" },
      middlewareMode: true,
    },
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${defaultPort}`}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (isBareAnthropicRoute(url.pathname)) {
      assertLocalRequest(req);
      const proxyUrl = new URL(`/api/anthropic${url.pathname}${url.search}`, url);
      await handleAnthropic(req, res, proxyUrl);
      return;
    }
    if (isBareLocalRoute(url.pathname)) {
      assertLocalRequest(req);
      throw new HttpError(410, "This endpoint is handled in the local browser store. Use the Raddus Canvas frontend or /api/anthropic/* for Anthropic proxy calls.");
    }
    if (vite) {
      vite.middlewares(req, res, (error) => {
        if (error) sendError(res, error);
      });
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendError(res, error);
  }
});

const port = await listenOnAvailablePort(server, Number.isFinite(defaultPort) ? defaultPort : 5174);
const interval = setInterval(pruneExpiredSessions, 60_000);
interval.unref?.();

console.log(`Raddus Canvas listening at http://${host}:${port}`);

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  assertLocalRequest(req);
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    await handleLogin(req, res);
    return;
  }
  if (url.pathname === "/api/auth/session" && req.method === "GET") {
    await ensureSession(req, res);
    sendJson(res, 200, authPayload());
    return;
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const sessionId = readSessionId(req);
    if (sessionId) sessions.delete(sessionId);
    await clearStoredApiKey();
    setSessionCookie(res, "", 0);
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url.pathname.startsWith("/api/local-store/")) {
    await handleLocalStore(req, res, url);
    return;
  }
  if (url.pathname.startsWith("/api/anthropic/")) {
    await handleAnthropic(req, res, url);
    return;
  }
  throw new HttpError(404, "Unknown local API endpoint.");
}

async function handleLogin(req, res) {
  const apiKey = parseApiKey(req);
  const client = createAnthropicClient(apiKey);
  await client.models.list({ limit: 1 });
  await writeStoredApiKey(apiKey);
  const session = createServerSession(apiKey);
  setSessionCookie(res, session.id, sessionMaxAgeSeconds);
  sendJson(res, 200, authPayload());
}

async function handleAnthropic(req, res, url) {
  const session = await ensureSession(req, res);
  const client = createAnthropicClient(session.apiKey);
  const path = url.pathname.slice("/api/anthropic".length);
  const segments = path.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readJsonBody(req);
  const result = await routeAnthropicRequest(client, req.method ?? "GET", segments, body);
  sendJson(res, 200, result);
}

async function handleLocalStore(req, res, url) {
  const segments = url.pathname.slice("/api/local-store/".length).split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const [resource, id] = segments;

  if (resource === "import" && req.method === "POST" && segments.length === 1) {
    const body = asPayload(await readJsonBody(req));
    const data = await updateLocalData((current) => mergeImportedLocalData(current, body));
    sendJson(res, 200, localStorePayload(data));
    return;
  }

  if (resource === "settings") {
    if (req.method === "GET" && segments.length === 1) {
      sendJson(res, 200, { settings: (await readLocalData()).settings });
      return;
    }
    if (req.method === "PATCH" && segments.length === 1) {
      const body = asPayload(await readJsonBody(req));
      const data = await updateLocalData((current) => ({ ...current, settings: { ...current.settings, ...body } }));
      sendJson(res, 200, { settings: data.settings });
      return;
    }
  }

  if (localStoreNames.has(resource)) {
    if (req.method === "GET" && segments.length === 1) {
      sendJson(res, 200, { records: (await readLocalData())[resource] });
      return;
    }
    if (req.method === "PUT" && id && segments.length === 2) {
      const body = asPayload(await readJsonBody(req));
      const record = { ...body, id };
      const data = await updateLocalData((current) => ({
        ...current,
        [resource]: upsertLocalRecord(current[resource], record),
      }));
      sendJson(res, 200, { record: data[resource].find((item) => item.id === id) ?? record });
      return;
    }
    if (req.method === "DELETE" && id && segments.length === 2) {
      const data = await updateLocalData((current) => ({
        ...current,
        [resource]: current[resource].filter((record) => record.id !== id),
      }));
      sendJson(res, 200, { ok: true, records: data[resource] });
      return;
    }
  }

  throw new HttpError(404, `Unknown local store endpoint: ${req.method} /${segments.join("/")}`);
}

async function routeAnthropicRequest(client, method, segments, body) {
  const [resource, id, child, childId] = segments;
  if (resource === "agents") {
    if (method === "GET" && segments.length === 1) return collect(client.beta.agents.list({ limit: 100 }));
    if (method === "POST" && segments.length === 1) return client.beta.agents.create(asPayload(body));
    if (method === "PATCH" && id && segments.length === 2) return client.beta.agents.update(id, asPayload(body));
    if (method === "POST" && id && child === "archive" && segments.length === 3) return client.beta.agents.archive(id);
  }
  if (resource === "environments") {
    if (method === "GET" && segments.length === 1) return collect(client.beta.environments.list({ limit: 100 }));
    if (method === "POST" && segments.length === 1) return client.beta.environments.create(asPayload(body));
    if (method === "PATCH" && id && segments.length === 2) return client.beta.environments.update(id, asPayload(body));
    if (method === "DELETE" && id && segments.length === 2) return client.beta.environments.delete(id);
  }
  if (resource === "deployments") {
    if (method === "GET" && segments.length === 1) return collect(client.beta.deployments.list({ limit: 100 }));
    if (method === "POST" && segments.length === 1) return client.beta.deployments.create(asPayload(body));
    if (method === "POST" && id && child === "run" && segments.length === 3) return client.beta.deployments.run(id);
    if (method === "DELETE" && id && segments.length === 2) return client.beta.deployments.archive(id);
  }
  if (resource === "sessions") {
    if (method === "GET" && segments.length === 1) return collect(client.beta.sessions.list({ limit: 100 }));
    if (method === "POST" && segments.length === 1) return client.beta.sessions.create(asPayload(body));
    if (method === "DELETE" && id && segments.length === 2) return client.beta.sessions.delete(id);
    if (method === "GET" && id && child === "events" && segments.length === 3) return collect(client.beta.sessions.events.list(id, { limit: 100, order: "asc" }));
    if (method === "POST" && id && child === "events" && segments.length === 3) return client.beta.sessions.events.send(id, asPayload(body));
    if (method === "POST" && id && child === "interrupt" && segments.length === 3) return client.beta.sessions.events.send(id, { events: [{ type: "user.interrupt" }] });
  }
  if (resource === "vaults") {
    if (method === "GET" && segments.length === 1) return collect(client.beta.vaults.list({ limit: 100 }));
    if (method === "POST" && segments.length === 1) return client.beta.vaults.create(asPayload(body));
    if (method === "DELETE" && id && segments.length === 2) return client.beta.vaults.delete(id);
    if (method === "GET" && id && child === "credentials" && segments.length === 3) return collect(client.beta.vaults.credentials.list(id, { limit: 100 }));
    if (method === "POST" && id && child === "credentials" && segments.length === 3) return client.beta.vaults.credentials.create(id, asPayload(body));
    if (method === "DELETE" && id && child === "credentials" && childId && segments.length === 4) return client.beta.vaults.credentials.delete(childId, { vault_id: id });
  }
  if (resource === "skills") {
    if (method === "GET" && segments.length === 1) return collect(client.beta.skills.list({ limit: 100 }));
  }
  if (resource === "messages") {
    if (method === "POST" && segments.length === 1) return client.messages.create(asPayload(body));
  }
  throw new HttpError(404, `Local Anthropic proxy does not implement ${method} /${segments.join("/")}`);
}

function parseApiKey(req) {
  const authHeader = String(req.headers.authorization ?? "");
  const apiKey = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!apiKey) throw new HttpError(401, "Missing Anthropic API key.");
  if (apiKey.includes("Web browsers: disabled by default") || apiKey.includes("dangerouslyAllowBrowser")) {
    throw new HttpError(400, "That value is the SDK browser warning, not an Anthropic API key. Paste an API key from the Anthropic Console.");
  }
  return apiKey;
}

function createAnthropicClient(apiKey) {
  return new Anthropic({
    apiKey,
    maxRetries: 0,
  });
}

async function ensureSession(req, res) {
  const existing = getExistingSession(req);
  if (existing) return existing;

  const apiKey = await readStoredApiKey();
  if (!apiKey) throw new HttpError(401, "Sign in with your Anthropic API key.");

  const session = createServerSession(apiKey);
  setSessionCookie(res, session.id, sessionMaxAgeSeconds);
  return session;
}

function createServerSession(apiKey) {
  const sessionId = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session = { id: sessionId, apiKey, createdAt: now, lastSeenAt: now };
  sessions.set(sessionId, session);
  return session;
}

function getExistingSession(req) {
  const sessionId = readSessionId(req);
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session || Date.now() - session.lastSeenAt > sessionMaxAgeSeconds * 1000) {
    if (sessionId) sessions.delete(sessionId);
    return null;
  }
  session.lastSeenAt = Date.now();
  return session;
}

function getSession(req) {
  const session = getExistingSession(req);
  if (!session) throw new HttpError(401, "Sign in with your Anthropic API key.");
  return session;
}

function readSessionId(req) {
  const cookie = String(req.headers.cookie ?? "");
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`));
  return match ? decodeURIComponent(match.slice(sessionCookieName.length + 1)) : null;
}

function setSessionCookie(res, sessionId, maxAge) {
  const value = sessionId ? encodeURIComponent(sessionId) : "";
  res.setHeader("set-cookie", `${sessionCookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
}

function authPayload() {
  return {
    token: "local-proxy-session",
    uuid: localUserId,
    email: localUserEmail,
    role: "admin",
  };
}

function resolveLocalDataFile() {
  if (process.env.RADDUS_CANVAS_DATA_FILE) return resolve(process.env.RADDUS_CANVAS_DATA_FILE);
  const currentPlatform = platform();
  if (currentPlatform === "darwin") return join(homedir(), "Library", "Application Support", "Raddus Canvas", "data.json");
  if (currentPlatform === "win32") return join(process.env.APPDATA ?? homedir(), "Raddus Canvas", "data.json");
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "raddus-canvas", "data.json");
}

function defaultLocalData() {
  return {
    version: 1,
    projects: [],
    mcpServers: [],
    settings: {},
  };
}

async function readLocalData() {
  try {
    const text = await readFile(localDataFile, "utf8");
    return normalizeLocalData(JSON.parse(text));
  } catch (error) {
    if (error?.code === "ENOENT") return defaultLocalData();
    throw error;
  }
}

async function updateLocalData(update) {
  const run = localDataWriteQueue.then(async () => {
    const current = await readLocalData();
    const next = normalizeLocalData(await update(current));
    await writeLocalData(next);
    return next;
  });
  localDataWriteQueue = run.catch(() => undefined);
  return run;
}

async function writeLocalData(data) {
  await mkdir(dirname(localDataFile), { recursive: true });
  const tempFile = `${localDataFile}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(tempFile, localDataFile);
}

function normalizeLocalData(value) {
  const record = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    projects: Array.isArray(record.projects) ? record.projects.filter(isLocalRecord) : [],
    mcpServers: Array.isArray(record.mcpServers) ? record.mcpServers.filter(isLocalRecord) : [],
    settings: record.settings && typeof record.settings === "object" && !Array.isArray(record.settings) ? record.settings : {},
  };
}

function mergeImportedLocalData(current, body) {
  const imported = normalizeLocalData(body);
  return {
    ...current,
    projects: mergeLocalRecords(current.projects, imported.projects),
    mcpServers: mergeLocalRecords(current.mcpServers, imported.mcpServers),
    settings: { ...imported.settings, ...current.settings },
  };
}

function localStorePayload(data) {
  return {
    projects: data.projects,
    mcpServers: data.mcpServers,
    settings: data.settings,
  };
}

function isLocalRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string" && value.id.trim());
}

function upsertLocalRecord(records, record) {
  const nextRecord = { ...record, id: String(record.id) };
  const index = records.findIndex((item) => item.id === nextRecord.id);
  if (index < 0) return [...records, nextRecord];
  return records.map((item, itemIndex) => (itemIndex === index ? nextRecord : item));
}

function mergeLocalRecords(current, imported) {
  let next = [...current];
  for (const record of imported) {
    if (!next.some((item) => item.id === record.id)) next = [...next, record];
  }
  return next;
}

async function readStoredApiKey() {
  if (platform() !== "darwin") return memoryApiKey;
  const result = await runSecurity(["find-generic-password", "-a", keychainAccount, "-s", keychainService, "-w"], { allowMissing: true });
  return result ? result.trim() || null : null;
}

async function writeStoredApiKey(apiKey) {
  if (platform() !== "darwin") {
    memoryApiKey = apiKey;
    return;
  }
  await runSecurity(["add-generic-password", "-a", keychainAccount, "-s", keychainService, "-w", apiKey, "-U"]);
}

async function clearStoredApiKey() {
  memoryApiKey = null;
  if (platform() !== "darwin") return;
  await runSecurity(["delete-generic-password", "-a", keychainAccount, "-s", keychainService], { allowMissing: true });
}

function runSecurity(args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    execFile("security", args, { encoding: "utf8" }, (error, stdout, stderr) => {
      const message = `${stdout ?? ""}${stderr ?? ""}`;
      if (error) {
        if (options.allowMissing && /could not be found|The specified item could not be found|SecKeychainSearchCopyNext/.test(message)) {
          resolveRun("");
          return;
        }
        rejectRun(new HttpError(500, `macOS Keychain operation failed: ${String(stderr || error.message).trim()}`));
        return;
      }
      resolveRun(stdout ?? "");
    });
  });
}

function assertLocalRequest(req) {
  const hostHeader = String(req.headers.host ?? "");
  const hostName = hostHeader.split(":")[0]?.toLowerCase();
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostName)) {
    throw new HttpError(403, "Raddus Canvas only accepts loopback requests.");
  }
  const origin = req.headers.origin;
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(String(origin)).host;
    } catch {
      throw new HttpError(403, "Invalid request origin.");
    }
    if (originHost !== hostHeader) {
      throw new HttpError(403, "Raddus Canvas only accepts same-origin requests.");
    }
  }
}

function isBareAnthropicRoute(pathname) {
  const [root] = pathname.split("/").filter(Boolean);
  return Boolean(root && bareAnthropicRoutes.has(root));
}

function isBareLocalRoute(pathname) {
  const [root] = pathname.split("/").filter(Boolean);
  return Boolean(root && bareLocalRoutes.has(root));
}

async function readJsonBody(req) {
  const text = await readBody(req);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        rejectBody(new HttpError(413, "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectBody);
  });
}

function asPayload(body) {
  return body && typeof body === "object" ? body : {};
}

async function collect(page) {
  const items = [];
  for await (const item of page) items.push(item);
  return items;
}

function pruneExpiredSessions() {
  const cutoff = Date.now() - sessionMaxAgeSeconds * 1000;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastSeenAt < cutoff) sessions.delete(sessionId);
  }
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed.");
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  let filePath = resolve(distDir, requested);
  if (filePath !== distDir && !filePath.startsWith(`${distDir}${sep}`)) throw new HttpError(403, "Forbidden.");
  if (!existsSync(filePath)) filePath = resolve(distDir, "index.html");
  const contentType = contentTypeFor(filePath);
  res.writeHead(200, { "content-type": contentType });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case ".css": return "text/css; charset=utf-8";
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  const status = error instanceof HttpError ? error.status : error instanceof APIError ? error.status ?? 502 : 500;
  const requestId = error instanceof APIError ? error.requestID ?? null : null;
  const message = error instanceof HttpError || error instanceof APIError ? error.message : "Raddus Canvas server error.";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    ...(requestId ? { "x-request-id": requestId } : {}),
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify({ error: { message }, request_id: requestId }));
}

function listenOnAvailablePort(targetServer, startPort) {
  return new Promise((resolveListen, rejectListen) => {
    const tryPort = (candidatePort) => {
      const onError = (error) => {
        targetServer.off("listening", onListening);
        if (error?.code === "EADDRINUSE" && candidatePort < startPort + 20) {
          tryPort(candidatePort + 1);
        } else {
          rejectListen(error);
        }
      };
      const onListening = () => {
        targetServer.off("error", onError);
        resolveListen(candidatePort);
      };
      targetServer.once("error", onError);
      targetServer.once("listening", onListening);
      targetServer.listen(candidatePort, host);
    };
    tryPort(startPort);
  });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
