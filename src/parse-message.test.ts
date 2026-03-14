import { describe, it, expect } from "vitest";
import { ZenzapAdapter } from "./adapter";
import type { ZenzapMessage } from "./types";

const adapter = new ZenzapAdapter({
  apiKey: "test-key",
  apiSecret: "test-secret",
});

function makeRawMessage(overrides: Partial<ZenzapMessage> = {}): ZenzapMessage {
  return {
    id: "msg-1",
    topicId: "topic-1",
    senderId: "user-1",
    senderName: "Alice",
    senderType: "user",
    text: "Hello world",
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

describe("parseMessage", () => {
  it("should parse a plain text message", () => {
    const raw = makeRawMessage({ text: "Hello world" });
    const message = adapter.parseMessage(raw);

    expect(message.id).toBe("msg-1");
    expect(message.text).toBe("Hello world");
    expect(message.author.userId).toBe("user-1");
    expect(message.author.userName).toBe("Alice");
    expect(message.author.fullName).toBe("Alice");
  });

  it("should detect bot messages", () => {
    const raw = makeRawMessage({
      senderId: "bot-1",
      senderName: "Bot",
      senderType: "bot",
    });
    const message = adapter.parseMessage(raw);
    expect(message.author.isBot).toBe(true);
  });

  it("should map attachments", () => {
    const raw = makeRawMessage({
      attachments: [
        {
          id: "att-1",
          type: "image",
          name: "photo.png",
          url: "https://example.com/photo.png",
        },
        {
          id: "att-2",
          type: "file",
          name: "doc.pdf",
          url: "https://example.com/doc.pdf",
        },
      ],
    });
    const message = adapter.parseMessage(raw);

    expect(message.attachments).toHaveLength(2);
    expect(message.attachments[0].type).toBe("image");
    expect(message.attachments[0].name).toBe("photo.png");
    expect(message.attachments[0].url).toBe("https://example.com/photo.png");
    expect(message.attachments[1].type).toBe("file");
    expect(message.attachments[1].name).toBe("doc.pdf");
  });

  it("should handle edited messages (isEdited: true)", () => {
    const raw = makeRawMessage({ isEdited: true });
    const message = adapter.parseMessage(raw);
    expect(message.metadata.edited).toBe(true);
  });

  it("should set correct dateSent from createdAt", () => {
    const timestamp = 1700000000000;
    const raw = makeRawMessage({ createdAt: timestamp });
    const message = adapter.parseMessage(raw);
    expect(message.metadata.dateSent).toEqual(new Date(timestamp));
  });

  it("should handle missing optional fields gracefully", () => {
    const raw: ZenzapMessage = {
      id: "msg-minimal",
      topicId: "topic-1",
      senderId: "user-1",
      senderType: "user",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    const message = adapter.parseMessage(raw);
    expect(message.text).toBe("");
    expect(message.author.userName).toBe("user-1");
    expect(message.author.fullName).toBe("");
    expect(message.attachments).toHaveLength(0);
    expect(message.metadata.edited).toBe(false);
  });

  it("should handle attachments without all fields", () => {
    const raw = makeRawMessage({
      attachments: [
        { type: "image" } as any,
      ],
    });
    const message = adapter.parseMessage(raw);
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0].type).toBe("image");
  });
});
