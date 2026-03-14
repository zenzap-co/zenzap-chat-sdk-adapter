import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZenzapAdapter } from "./adapter";
import type { ZenzapMessage, ZenzapPollingUpdate } from "./types";

function makeRawMessage(overrides: Partial<ZenzapMessage> = {}): ZenzapMessage {
  return {
    id: "msg-1",
    topicId: "topic-1",
    senderId: "user-1",
    senderName: "Alice",
    senderType: "user",
    text: "Hello",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    isEdited: false,
    isSystem: false,
    replyCount: 0,
    attachments: [],
    mentions: [],
    reactions: [],
    ...overrides,
  };
}

function makeUpdate(
  eventType: ZenzapPollingUpdate["eventType"],
  data: Record<string, unknown>,
): ZenzapPollingUpdate {
  return {
    updateId: "upd-1",
    eventType,
    createdAt: Date.now(),
    data,
  };
}

describe("handleWebhook", () => {
  let adapter: ZenzapAdapter;
  let mockChat: {
    processMessage: ReturnType<typeof vi.fn>;
    getLogger: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    adapter = new ZenzapAdapter({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    mockChat = {
      processMessage: vi.fn(),
      getLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    };

    // Inject the mock chat instance via initialize's side effect.
    // We access the private field directly for testing purposes.
    (adapter as unknown as { chat: unknown }).chat = mockChat;
    (adapter as unknown as { botUserId: string }).botUserId = "bot-42";
  });

  it("should return 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: "not valid json {{{",
    });

    const response = await adapter.handleWebhook(request);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe("Invalid JSON");
  });

  it("should return 200 for valid update payload", async () => {
    const update = makeUpdate(
      "message.created",
      makeRawMessage() as unknown as Record<string, unknown>,
    );

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify(update),
      headers: { "Content-Type": "application/json" },
    });

    const response = await adapter.handleWebhook(request);
    expect(response.status).toBe(200);
  });

  it("should process message.created events", async () => {
    const rawMsg = makeRawMessage({ senderId: "user-99" });
    const update = makeUpdate(
      "message.created",
      rawMsg as unknown as Record<string, unknown>,
    );

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify(update),
      headers: { "Content-Type": "application/json" },
    });

    await adapter.handleWebhook(request);

    expect(mockChat.processMessage).toHaveBeenCalledTimes(1);
    expect(mockChat.processMessage).toHaveBeenCalledWith(
      adapter,
      expect.stringContaining("zenzap:"),
      expect.any(Function),
      undefined,
    );
  });

  it("should skip messages from the bot itself", async () => {
    const rawMsg = makeRawMessage({ senderId: "bot-42" });
    const update = makeUpdate(
      "message.created",
      rawMsg as unknown as Record<string, unknown>,
    );

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify(update),
      headers: { "Content-Type": "application/json" },
    });

    await adapter.handleWebhook(request);

    expect(mockChat.processMessage).not.toHaveBeenCalled();
  });
});
