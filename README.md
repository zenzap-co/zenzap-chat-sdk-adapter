# chat-adapter-zenzap

A [Chat SDK](https://chat-sdk.dev) adapter for [Zenzap](https://zenzap.co) — build platform-agnostic chatbots that work with Zenzap's messaging API.

## Installation

```bash
npm install chat chat-adapter-zenzap
```

## Quick start

```typescript
import { Chat } from "chat";
import { createZenzapAdapter } from "chat-adapter-zenzap";

const chat = new Chat({
  userName: "my-bot",
  adapters: {
    zenzap: createZenzapAdapter(),
  },
});

chat.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await thread.post("Hello! I'm now watching this thread.");
});

chat.onSubscribedMessage(async (thread, message) => {
  await thread.post(`You said: ${message.text}`);
});
```

## Configuration

The adapter requires a Zenzap API key and secret. Pass them directly or set environment variables:

| Env variable | Description |
|---|---|
| `ZENZAP_API_KEY` | Zenzap API key (used as Bearer token) |
| `ZENZAP_API_SECRET` | Zenzap API secret (used for HMAC-SHA256 request signing) |
| `ZENZAP_BASE_URL` | Optional. Defaults to `https://api.zenzap.co` |

```typescript
createZenzapAdapter({
  apiKey: "your-api-key",
  apiSecret: "your-api-secret",
});
```

API keys are created in the Zenzap admin panel. Each key generates a bot user that sends messages on your behalf. See the [Zenzap API docs](https://docs.zenzap.co/api-reference/getting-started) for details.

## Receiving messages

Zenzap uses **long polling** rather than webhooks. There are two ways to receive messages:

### Long polling (standalone / long-running servers)

```typescript
import { ZenzapAdapter } from "chat-adapter-zenzap";

await chat.initialize();

const adapter = chat.adapters.zenzap as ZenzapAdapter;
adapter.startPolling();

// Later:
// adapter.stopPolling();
```

### Webhook route (serverless / Vercel)

In serverless environments you can't run a persistent polling loop. Instead, poll on a schedule and forward updates to a webhook handler.

**Webhook handler** (`app/api/chat/zenzap/route.ts`):

```typescript
import { chat } from "@/lib/chat";

export async function POST(request: Request) {
  return chat.webhooks.zenzap(request);
}
```

**Cron-triggered poller** (`app/api/cron/poll-zenzap/route.ts`):

```typescript
import { ZenzapApiClient } from "chat-adapter-zenzap";

const api = new ZenzapApiClient({
  apiKey: process.env.ZENZAP_API_KEY!,
  apiSecret: process.env.ZENZAP_API_SECRET!,
});

export async function GET(request: Request) {
  const offset = /* read from KV / database */;

  const updates = await api.getUpdates(offset, 50, 0);

  for (const update of updates.updates) {
    await fetch(`${process.env.VERCEL_URL}/api/chat/zenzap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
  }

  /* persist updates.nextOffset to KV / database */

  return Response.json({ processed: updates.updates.length });
}
```

**`vercel.json`**:

```json
{
  "crons": [{ "path": "/api/cron/poll-zenzap", "schedule": "* * * * *" }]
}
```

> **Note:** Per-minute crons require Vercel Pro. Persist `nextOffset` in Vercel KV, Upstash Redis, or a database to avoid reprocessing events across invocations.

## Supported features

| Feature | Supported |
|---|---|
| Send messages | Yes |
| Receive messages | Yes (long polling or webhook) |
| Fetch message history | Yes (cursor-based pagination) |
| Reactions | Yes (add only — removal in progress) |
| Attachments (receive) | Yes |
| File uploads (send) | In progress |
| Edit messages | In progress |
| Delete messages | In progress |
| Typing indicators | In progress |
| Streaming | In progress |

## Exports

```typescript
import {
  ZenzapAdapter,          // Adapter class
  ZenzapApiClient,        // Standalone API client
  ZenzapFormatConverter,  // Markdown ↔ mdast converter
  createZenzapAdapter,    // Factory function
} from "chat-adapter-zenzap";
```

## Development

```bash
npm install
npm run build        # Build with tsup
npm run typecheck    # Type check
npm test             # Run tests
npm run dev          # Watch mode
```

## Publishing

Releases are managed via GitHub Actions. Trigger a release from the Actions tab:

- **Stable release**: Creates a version-bump PR. Merging it tags and publishes to npm with the `latest` tag.
- **Dev snapshot**: Publishes immediately with a `dev` tag (e.g. `0.1.0-dev.abc1234`).

Requires an `NPM_TOKEN` secret in the repo settings.

## License

MIT
