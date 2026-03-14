import { ValidationError } from "@chat-adapter/shared";
import type { Logger } from "chat";
import { ZenzapAdapter } from "./adapter";
import type { ZenzapAdapterConfig } from "./types";

/**
 * Create a configured Zenzap adapter instance.
 *
 * Credentials can be passed directly or read from environment variables:
 * - `ZENZAP_API_KEY`
 * - `ZENZAP_API_SECRET`
 * - `ZENZAP_BASE_URL` (optional, defaults to https://api.zenzap.co)
 */
export function createZenzapAdapter(
  config?: Partial<ZenzapAdapterConfig> & { logger?: Logger },
): ZenzapAdapter {
  const apiKey = config?.apiKey ?? process.env.ZENZAP_API_KEY;
  const apiSecret = config?.apiSecret ?? process.env.ZENZAP_API_SECRET;
  const baseUrl = config?.baseUrl ?? process.env.ZENZAP_BASE_URL;

  if (!apiKey) {
    throw new ValidationError(
      "zenzap",
      "Zenzap API key is required. Pass it in config or set ZENZAP_API_KEY.",
    );
  }
  if (!apiSecret) {
    throw new ValidationError(
      "zenzap",
      "Zenzap API secret is required. Pass it in config or set ZENZAP_API_SECRET.",
    );
  }

  return new ZenzapAdapter({
    apiKey,
    apiSecret,
    baseUrl,
    userName: config?.userName,
    logger: config?.logger,
  });
}
