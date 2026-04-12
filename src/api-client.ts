import crypto from "node:crypto";
import {
  AdapterRateLimitError,
  AuthenticationError,
  NetworkError,
  ResourceNotFoundError,
} from "@chat-adapter/shared";
import type {
  ZenzapAdapterConfig,
  ZenzapMember,
  ZenzapMessage,
  ZenzapTopic,
  ZenzapUpdatesResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://api.zenzap.co";
const ADAPTER_NAME = "zenzap";

export class ZenzapApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(config: ZenzapAdapterConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  // ---------------------------------------------------------------------------
  // Signature helpers
  // ---------------------------------------------------------------------------

  private sign(payload: string): { signature: string; timestamp: string } {
    const timestamp = Date.now().toString();
    const data = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(data)
      .digest("hex");
    return { signature, timestamp };
  }

  private authHeaders(
    method: string,
    path: string,
    body?: string,
  ): Record<string, string> {
    const payload = method === "GET" ? path : (body ?? "");
    const { signature, timestamp } = this.sign(payload);
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    };
  }

  // ---------------------------------------------------------------------------
  // Generic request helper
  // ---------------------------------------------------------------------------

  private async request<T>({
    method,
    path,
    body,
  }: {
    method: string;
    path: string;
    body?: unknown;
  }): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    // Compact JSON serialization (no spaces) as required by Zenzap
    const compactBody =
      body !== undefined ? JSON.stringify(body) : undefined;

    const headers: Record<string, string> = {
      ...this.authHeaders(method, path, compactBody),
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: compactBody,
      });
    } catch (err) {
      throw new NetworkError(
        ADAPTER_NAME,
        `Zenzap API request failed: ${(err as Error).message}`,
        err as Error,
      );
    }

    if (response.status === 401) {
      throw new AuthenticationError(ADAPTER_NAME, "Invalid Zenzap API credentials");
    }
    if (response.status === 404) {
      throw new ResourceNotFoundError(ADAPTER_NAME, "resource", path);
    }
    if (response.status === 429) {
      throw new AdapterRateLimitError(ADAPTER_NAME);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new NetworkError(
        ADAPTER_NAME,
        `Zenzap API error ${response.status}: ${text}`,
      );
    }

    // Some endpoints return 204 / empty body
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new NetworkError(
        ADAPTER_NAME,
        `Zenzap API returned invalid JSON for ${method} ${path}: ${text.substring(0, 200)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------

  async getCurrentMember(): Promise<ZenzapMember> {
    return this.request<ZenzapMember>({ method: "GET", path: "/v2/members/me" });
  }

  async listMembers(
    cursor?: string,
    limit = 50,
  ): Promise<{ members: ZenzapMember[]; nextCursor?: string; hasMore: boolean }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return this.request({ method: "GET", path: `/v2/members?${params}` });
  }

  // ---------------------------------------------------------------------------
  // Topics
  // ---------------------------------------------------------------------------

  async listTopics(
    cursor?: string,
    limit = 50,
  ): Promise<{ topics: ZenzapTopic[]; nextCursor?: string; hasMore: boolean }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return this.request({ method: "GET", path: `/v2/topics?${params}` });
  }

  async getTopic(topicId: string): Promise<{ id: string; name: string; description: string; memberIds: string[]; type: "topic" | "dm" }> {
    return this.request({ method: "GET", path: `/v2/topics/${topicId}` });
  }

  async createTopic(data: {
    name: string;
    members: string[];
    description?: string;
    externalId?: string;
  }): Promise<{ id: string; name: string; members: string[]; externalId?: string; createdAt: number }> {
    return this.request({ method: "POST", path: "/v2/topics", body: data });
  }

  async getTopicMessages(
    topicId: string,
    options?: {
      limit?: number;
      cursor?: string;
      before?: number;
      after?: number;
      order?: "asc" | "desc";
      threadId?: string;
    },
  ): Promise<{ messages: ZenzapMessage[]; nextCursor?: string; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    if (options?.before) params.set("before", String(options.before));
    if (options?.after) params.set("after", String(options.after));
    if (options?.order) params.set("order", options.order);
    if (options?.threadId) params.set("threadId", options.threadId);
    const qs = params.toString();
    return this.request({
      method: "GET",
      path: `/v2/topics/${topicId}/messages${qs ? `?${qs}` : ""}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  async getMessage(
    messageId: string,
  ): Promise<{
    messageId: string;
    channelId: string;
    senderId: string;
    text: string;
    type: string;
    externalId?: string;
    createdAt: number;
    updatedAt: number;
  }> {
    return this.request({ method: "GET", path: `/v2/messages/${messageId}` });
  }

  async sendMessage(data: {
    topicId: string;
    text: string;
    externalId?: string;
  }): Promise<{ id: string; topicId: string; createdAt: number }> {
    return this.request({ method: "POST", path: "/v2/messages", body: data });
  }

  async editMessage(
    messageId: string,
    data: { text: string },
  ): Promise<{ id: string; updatedAt: number }> {
    return this.request({
      method: "PATCH",
      path: `/v2/messages/${messageId}`,
      body: data,
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.request({
      method: "DELETE",
      path: `/v2/messages/${messageId}`,
    });
  }

  async addReaction(
    messageId: string,
    reaction: string,
  ): Promise<{ id: string; messageId: string; reaction: string; createdAt: number }> {
    return this.request({
      method: "POST",
      path: `/v2/messages/${messageId}/reactions`,
      body: { reaction },
    });
  }

  async removeReaction(
    messageId: string,
    reactionId: string,
  ): Promise<void> {
    return this.request({
      method: "DELETE",
      path: `/v2/messages/${messageId}/reactions/${reactionId}`,
    });
  }

  async markDelivered(messageId: string): Promise<void> {
    return this.request({ method: "POST", path: `/v2/messages/${messageId}/delivered` });
  }

  async markRead(messageId: string): Promise<void> {
    return this.request({ method: "POST", path: `/v2/messages/${messageId}/read` });
  }

  // ---------------------------------------------------------------------------
  // Topic members
  // ---------------------------------------------------------------------------

  async addMembers(
    topicId: string,
    memberIds: string[],
  ): Promise<{ id: string; memberIds: string[]; updatedAt: number }> {
    return this.request({
      method: "POST",
      path: `/v2/topics/${topicId}/members`,
      body: { memberIds },
    });
  }

  async removeMembers(
    topicId: string,
    memberIds: string[],
  ): Promise<{ id: string; memberIds: string[]; updatedAt: number }> {
    return this.request({
      method: "DELETE",
      path: `/v2/topics/${topicId}/members`,
      body: { memberIds },
    });
  }

  async updateTopic(
    topicId: string,
    data: { name?: string; description?: string },
  ): Promise<void> {
    return this.request({ method: "PATCH", path: `/v2/topics/${topicId}`, body: data });
  }

  // ---------------------------------------------------------------------------
  // Long polling
  // ---------------------------------------------------------------------------

  async getUpdates(
    offset?: string,
    limit = 50,
    timeout = 25,
  ): Promise<ZenzapUpdatesResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      timeout: String(timeout),
    });
    if (offset) params.set("offset", offset);
    return this.request({ method: "GET", path: `/v2/updates?${params}` });
  }
}
