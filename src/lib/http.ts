import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiUnavailableError } from "./ai";
import { ConfigError } from "./env";
import { PayPalError } from "./paypal";
import { PricingError } from "./pricing";
import { getStandRecord } from "./store";
import type { StandRecord } from "./types";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Every API error leaves as { error } with a plain-language message and no internals. */
export function handleError(error: unknown): NextResponse {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: "Some of the details sent weren't valid." }, 400);
  if (error instanceof PricingError) return json({ error: error.message }, 400);
  if (error instanceof AiUnavailableError) return json({ error: error.message, manual: true }, 503);
  if (error instanceof ConfigError) {
    console.error("[candid] config", error.message);
    return json({ error: "Payments aren't configured on this server yet." }, 503);
  }
  if (error instanceof PayPalError) {
    console.error("[candid] paypal", error.status, error.debugId, error.message);
    return json({ error: error.message }, 502);
  }
  console.error("[candid] unexpected", error);
  return json({ error: "Something went wrong on our side. Please try again." }, 500);
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const ownerCookieName = (standId: string) => `candid_owner_${standId}`;

export async function requireStand(standId: string): Promise<StandRecord> {
  const record = await getStandRecord(standId);
  if (!record) throw new HttpError(404, "We couldn't find that stand.");
  return record;
}

/** Owner-only routes. The demo stand is open so judges can try the owner view. */
export async function requireOwner(standId: string): Promise<StandRecord> {
  const record = await requireStand(standId);
  if (record.stand.isDemo) return record;
  const key = (await cookies()).get(ownerCookieName(standId))?.value;
  if (!key) throw new HttpError(401, "Open this page from the device you used to set up the stand.");
  const given = Buffer.from(hashKey(key), "hex");
  const expected = Buffer.from(record.stand.ownerKeyHash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(403, "This device isn't the stand owner's.");
  }
  return record;
}

/** Same-origin check for state-changing requests (CSRF defence for cookie-authenticated routes). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked.");
}
