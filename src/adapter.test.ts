import { describe, it, expect } from "vitest";
import { ZenzapAdapter } from "./adapter";
import type { ZenzapMessage, ZenzapThreadId } from "./types";

const adapter = new ZenzapAdapter({
  apiKey: "test-key",
  apiSecret: "test-secret",
});

describe("ZenzapAdapter", () => {
  describe("encodeThreadId / decodeThreadId", () => {
    it("should roundtrip a topic-only thread ID", () => {
      const data: ZenzapThreadId = {
        topicId: "550e8400-e29b-41d4-a716-446655440001",
      };
      const encoded = adapter.encodeThreadId(data);
      expect(encoded.startsWith("zenzap:")).toBe(true);

      const decoded = adapter.decodeThreadId(encoded);
      expect(decoded.topicId).toBe(data.topicId);
      expect(decoded.threadId).toBeUndefined();
    });

    it("should roundtrip a topic + thread ID", () => {
      const data: ZenzapThreadId = {
        topicId: "550e8400-e29b-41d4-a716-446655440001",
        threadId: "660e8400-e29b-41d4-a716-446655440002",
      };
      const encoded = adapter.encodeThreadId(data);
      expect(encoded.split(":").length).toBe(3);

      const decoded = adapter.decodeThreadId(encoded);
      expect(decoded.topicId).toBe(data.topicId);
      expect(decoded.threadId).toBe(data.threadId);
    });

    it("should throw on invalid thread ID", () => {
      expect(() => adapter.decodeThreadId("invalid")).toThrow();
      expect(() => adapter.decodeThreadId("slack:abc")).toThrow();
    });
  });

  describe("channelIdFromThreadId", () => {
    it("should return the topic ID", () => {
      const data: ZenzapThreadId = {
        topicId: "my-topic-id",
        threadId: "some-thread",
      };
      const encoded = adapter.encodeThreadId(data);
      expect(adapter.channelIdFromThreadId(encoded)).toBe("my-topic-id");
    });
  });

  describe("parseMessage", () => {
    it("should parse a Zenzap message into a Message object", () => {
      const raw: ZenzapMessage = {
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
      };

      const message = adapter.parseMessage(raw);
      expect(message.id).toBe("msg-1");
      expect(message.text).toBe("Hello world");
      expect(message.author.userId).toBe("user-1");
      expect(message.author.userName).toBe("Alice");
      expect(message.author.fullName).toBe("Alice");
      expect(message.author.isBot).toBe(false);
      expect(message.metadata.edited).toBe(false);
    });

    it("should detect bot messages", () => {
      const raw: ZenzapMessage = {
        id: "msg-2",
        topicId: "topic-1",
        senderId: "bot-1",
        senderName: "Bot",
        senderType: "bot",
        text: "I am a bot",
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        isEdited: false,
        isSystem: false,
        replyCount: 0,
        attachments: [],
        mentions: [],
        reactions: [],
      };

      const message = adapter.parseMessage(raw);
      expect(message.author.isBot).toBe(true);
    });

    it("should map attachments", () => {
      const raw: ZenzapMessage = {
        id: "msg-3",
        topicId: "topic-1",
        senderId: "user-1",
        senderName: "Alice",
        senderType: "user",
        text: "See attached",
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        isEdited: false,
        isSystem: false,
        replyCount: 0,
        attachments: [
          { id: "att-1", type: "image", name: "photo.png", url: "https://example.com/photo.png" },
        ],
        mentions: [],
        reactions: [],
      };

      const message = adapter.parseMessage(raw);
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].type).toBe("image");
      expect(message.attachments[0].name).toBe("photo.png");
    });
  });

  describe("name", () => {
    it('should be "zenzap"', () => {
      expect(adapter.name).toBe("zenzap");
    });
  });
});
