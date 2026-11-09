import "server-only";
import { HttpError } from "./http";

/**
 * A small fixed-window limiter for the AI photo routes, so a public demo can't
 * be used to run up model costs. Per server instance, which is enough here.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(request: Request, bucket: string, limit = 20, windowMs = 10 * 60_000): void {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) throw new HttpError(429, "Too many photos in a short time. Wait a few minutes and try again.");
}
