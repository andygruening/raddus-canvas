import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { platform } from "node:os";
import { createAnthropicClient } from "./anthropicClient.mjs";
import {
  keychainAccount,
  keychainService,
  localUserEmail,
  localUserId,
  sessionCookieName,
  sessionMaxAgeSeconds,
} from "./config.mjs";
import { HttpError } from "./errors.mjs";
import { sendJson } from "./httpUtils.mjs";

const sessions = new Map();
let memoryApiKey = null;

export async function handleLogin(req, res) {
  const apiKey = parseApiKey(req);
  const client = createAnthropicClient(apiKey);
  await client.models.list({ limit: 1 });
  await writeStoredApiKey(apiKey);
  const session = createServerSession(apiKey);
  setSessionCookie(res, session.id, sessionMaxAgeSeconds);
  sendJson(res, 200, authPayload());
}

export async function handleLogout(req, res) {
  const sessionId = readSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  await clearStoredApiKey();
  setSessionCookie(res, "", 0);
  sendJson(res, 200, { ok: true });
}

export async function ensureSession(req, res) {
  const existing = getExistingSession(req);
  if (existing) return existing;

  const apiKey = await readStoredApiKey();
  if (!apiKey) throw new HttpError(401, "Sign in with your Anthropic API key.");

  const session = createServerSession(apiKey);
  setSessionCookie(res, session.id, sessionMaxAgeSeconds);
  return session;
}

export function authPayload() {
  return {
    token: "local-proxy-session",
    uuid: localUserId,
    email: localUserEmail,
    role: "admin",
  };
}

export function pruneExpiredSessions() {
  const cutoff = Date.now() - sessionMaxAgeSeconds * 1000;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastSeenAt < cutoff) sessions.delete(sessionId);
  }
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

function readSessionId(req) {
  const cookie = String(req.headers.cookie ?? "");
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`));
  return match ? decodeURIComponent(match.slice(sessionCookieName.length + 1)) : null;
}

function setSessionCookie(res, sessionId, maxAge) {
  const value = sessionId ? encodeURIComponent(sessionId) : "";
  res.setHeader("set-cookie", `${sessionCookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
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
