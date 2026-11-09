import "server-only";

export const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

export class ConfigError extends Error {}

/**
 * Candid only ever talks to the PayPal sandbox. Anything that looks like a live
 * configuration stops payments instead of risking real money.
 */
export function assertSandbox(env: NodeJS.ProcessEnv = process.env): void {
  const mode = (env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  if (mode !== "sandbox") throw new ConfigError(`PAYPAL_ENV must be "sandbox", got "${mode}".`);
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("PAYPAL") && value && /api-m\.paypal\.com|\/\/api\.paypal\.com/i.test(value)) {
      throw new ConfigError(`${key} points at a live PayPal host. Candid is sandbox-only.`);
    }
  }
}

export function paypalCredentials(): { clientId: string; clientSecret: string } {
  assertSandbox();
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ConfigError("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox app) in .env.local.");
  }
  return { clientId, clientSecret };
}

/**
 * How Gemini is reached: Vertex AI on a Google Cloud project (uses Application
 * Default Credentials), or a Gemini API key. Vertex wins when both are set.
 */
export function aiProvider(): "vertex" | "apikey" | null {
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_GENAI_USE_VERTEXAI === "true") return "vertex";
  if (process.env.GEMINI_API_KEY) return "apikey";
  return null;
}
