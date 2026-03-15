import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createZenzapAdapter } from "./factory";

describe("createZenzapAdapter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ZENZAP_API_KEY;
    delete process.env.ZENZAP_API_SECRET;
    delete process.env.ZENZAP_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should throw ValidationError when apiKey is missing", () => {
    expect(() => createZenzapAdapter({ apiSecret: "secret" })).toThrow(
      /API key is required/,
    );
  });

  it("should throw ValidationError when apiSecret is missing", () => {
    expect(() => createZenzapAdapter({ apiKey: "key" })).toThrow(
      /API secret is required/,
    );
  });

  it("should read from environment variables", () => {
    process.env.ZENZAP_API_KEY = "env-key";
    process.env.ZENZAP_API_SECRET = "env-secret";
    process.env.ZENZAP_BASE_URL = "https://custom.zenzap.co";

    const adapter = createZenzapAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("zenzap");
  });

  it("should use config values over env vars", () => {
    process.env.ZENZAP_API_KEY = "env-key";
    process.env.ZENZAP_API_SECRET = "env-secret";

    const adapter = createZenzapAdapter({
      apiKey: "config-key",
      apiSecret: "config-secret",
      userName: "my-bot",
    });

    expect(adapter).toBeDefined();
    expect(adapter.userName).toBe("my-bot");
  });

  it("should create adapter with defaults", () => {
    const adapter = createZenzapAdapter({
      apiKey: "key",
      apiSecret: "secret",
    });

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("zenzap");
    expect(adapter.userName).toBe("zenzap-bot");
  });
});
