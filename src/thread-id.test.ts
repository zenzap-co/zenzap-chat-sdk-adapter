import { describe, it, expect } from "vitest";
import { ZenzapAdapter } from "./adapter";
import type { ZenzapThreadId } from "./types";

const adapter = new ZenzapAdapter({
  apiKey: "test-key",
  apiSecret: "test-secret",
});

describe("Thread ID encoding / decoding", () => {
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

  it("should throw on invalid format", () => {
    expect(() => adapter.decodeThreadId("invalid")).toThrow();
    expect(() => adapter.decodeThreadId("slack:abc")).toThrow();
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
});
