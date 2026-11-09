import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { StandRecord } from "./types";
import { demoStandRecord, DEMO_STAND_ID } from "./demo";

/**
 * Storage for stand records. Locally each stand is one JSON file under .data/;
 * in a deployment with Upstash env vars set, the same records live in Redis.
 * Writes to one stand are serialised in-process so concurrent requests can't
 * overwrite each other's changes.
 */
interface Backend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), ".data");

const fileBackend: Backend = {
  async get(key) {
    try {
      return await fs.readFile(path.join(DATA_DIR, `${safeKey(key)}.json`), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async set(key, value) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, `${safeKey(key)}.json`);
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, value, "utf8");
    await fs.rename(tmp, file);
  },
};

function redisBackend(): Backend | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    get: (key) => redis.get<string>(`candid:${key}`),
    set: async (key, value) => {
      await redis.set(`candid:${key}`, value);
    },
  };
}

const backend: Backend = redisBackend() ?? fileBackend;

function safeKey(key: string): string {
  if (!/^[a-z0-9:_-]{1,100}$/i.test(key)) throw new Error("Invalid storage key");
  return key.replace(/:/g, "__");
}

const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  locks.set(key, run.catch(() => undefined));
  return run;
}

export async function getStandRecord(standId: string): Promise<StandRecord | null> {
  const raw = await backend.get(`stand:${standId}`);
  if (raw) return JSON.parse(raw) as StandRecord;
  if (standId !== DEMO_STAND_ID) return null;
  // Seed the demo stand on first use, once, even under concurrent requests.
  return withLock(`stand:${standId}`, () => readOrSeed(standId));
}

/** Reads a stand, seeding the demo stand if needed. Callers must hold the stand's lock. */
async function readOrSeed(standId: string): Promise<StandRecord | null> {
  const existing = await backend.get(`stand:${standId}`);
  if (existing) return JSON.parse(existing) as StandRecord;
  if (standId !== DEMO_STAND_ID) return null;
  const seeded = demoStandRecord();
  await backend.set(`stand:${standId}`, JSON.stringify(seeded));
  await backend.set(`slug:${seeded.stand.slug}`, standId);
  return seeded;
}

export async function getStandIdBySlug(slug: string): Promise<string | null> {
  if (slug === demoStandRecord().stand.slug) return DEMO_STAND_ID;
  return backend.get(`slug:${slug}`);
}

export async function createStandRecord(record: StandRecord): Promise<void> {
  await withLock(`stand:${record.stand.id}`, async () => {
    if (await backend.get(`slug:${record.stand.slug}`)) throw new Error("Slug already taken");
    await backend.set(`stand:${record.stand.id}`, JSON.stringify(record));
    await backend.set(`slug:${record.stand.slug}`, record.stand.id);
  });
}

/** Read-modify-write of one stand under a lock. */
export async function updateStandRecord<T>(standId: string, change: (record: StandRecord) => T | Promise<T>): Promise<T> {
  return withLock(`stand:${standId}`, async () => {
    const record = await readOrSeed(standId);
    if (!record) throw new Error(`Unknown stand ${standId}`);
    const result = await change(record);
    await backend.set(`stand:${standId}`, JSON.stringify(record));
    return result;
  });
}

export async function indexOrder(orderId: string, standId: string): Promise<void> {
  await backend.set(`order:${orderId}`, standId);
}

export async function standIdForOrder(orderId: string): Promise<string | null> {
  if (!/^[A-Z0-9]{5,40}$/.test(orderId)) return null;
  return backend.get(`order:${orderId}`);
}
