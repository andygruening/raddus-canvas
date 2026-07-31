import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { localDataFile, localStoreNames } from "./config.mjs";
import { HttpError } from "./errors.mjs";
import { asPayload, readJsonBody, sendJson } from "./httpUtils.mjs";

let localDataWriteQueue = Promise.resolve();

export async function handleLocalStore(req, res, url) {
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

function defaultLocalData() {
  return {
    version: 1,
    projects: [],
    mcpServers: [],
    settings: {},
  };
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
