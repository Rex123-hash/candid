import { describe, expect, it } from "vitest";
import { assertSandbox, ConfigError, PAYPAL_API_BASE } from "@/lib/env";

describe("sandbox guard", () => {
  it("only ever targets the PayPal sandbox", () => {
    expect(PAYPAL_API_BASE).toBe("https://api-m.sandbox.paypal.com");
  });

  it("accepts a sandbox configuration", () => {
    expect(() => assertSandbox({ PAYPAL_ENV: "sandbox" } as unknown as NodeJS.ProcessEnv)).not.toThrow();
    expect(() => assertSandbox({} as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });

  it("refuses live mode", () => {
    expect(() => assertSandbox({ PAYPAL_ENV: "live" } as unknown as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => assertSandbox({ PAYPAL_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toThrow(ConfigError);
  });

  it("refuses any PayPal setting that points at a live host", () => {
    expect(() =>
      assertSandbox({ PAYPAL_ENV: "sandbox", PAYPAL_BASE_URL: "https://api-m.paypal.com" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(ConfigError);
  });
});

