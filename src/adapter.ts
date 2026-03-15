import {
  extractCard,
  ValidationError,
} from "@chat-adapter/shared";
import type {
  Adapter,
  AdapterPostableMessage,
  Attachment,
  ChatInstance,
  EmojiValue,
  FetchOptions,
  FetchResult,
  FormattedContent,
  Logger,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from "chat";
import { ConsoleLogger, Message } from "chat";
import { ZenzapApiClient } from "./api-client";
import { ZenzapFormatConverter } from "./format-converter";
import type {
  ZenzapAdapterConfig,
  ZenzapMessage,
  ZenzapPollingUpdate,
  ZenzapThreadId,
} from "./types";

export class ZenzapAdapter
  implements Adapter<ZenzapThreadId, ZenzapMessage>
{
  readonly name = "zenzap";
  readonly userName: string;
  botUserId?: string;

  private chat: ChatInstance | null = null;
  private logger: Logger;
  private config: ZenzapAdapterConfig;
  private converter = new ZenzapFormatConverter();
  readonly api: ZenzapApiClient;

  // Long-polling state
  private pollingOffset?: string;
  private pollingActive = false;
  private pollingAbortController?: AbortController;

  constructor(config: ZenzapAdapterConfig & { logger?: Logger }) {
    this.config = config;
    this.userName = config.userName ?? "zenzap-bot";
    this.logger = config.logger ?? new ConsoleLogger();
    this.api = new ZenzapApiClient(config);
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
    this.logger = chat.getLogger("zenzap");

    // Fetch bot identity
    try {
      const me = await this.api.getCurrentMember();
      this.botUserId = me.id;
      this.logger.info(`Zenzap bot initialized as ${me.name} (${me.id})`);
    } catch (err) {
      this.logger.error("Failed to fetch bot identity", err as Error);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Thread ID encoding / decoding
  // ---------------------------------------------------------------------------

  encodeThreadId(data: ZenzapThreadId): string {
    const topicSegment = Buffer.from(data.topicId).toString("base64url");
    if (data.threadId) {
      const threadSegment = Buffer.from(data.threadId).toString("base64url");
      return `zenzap:${topicSegment}:${threadSegment}`;
    }
    return `zenzap:${topicSegment}`;
  }

  decodeThreadId(threadId: string): ZenzapThreadId {
    const parts = threadId.split(":");
    if (parts.length < 2 || parts[0] !== "zenzap") {
      throw new ValidationError("zenzap", `Invalid Zenzap thread ID: ${threadId}`);
    }
    const topicId = Buffer.from(parts[1], "base64url").toString();
    const threadIdDecoded = parts[2]
      ? Buffer.from(parts[2], "base64url").toString()
      : undefined;
    return { topicId, threadId: threadIdDecoded };
  }

  /**
   * Extract the channel (topic) ID from an encoded thread ID.
   * In Zenzap, a channel corresponds to a topic.
   */
  channelIdFromThreadId(threadId: string): string {
    const { topicId } = this.decodeThreadId(threadId);
    return topicId;
  }

  // ---------------------------------------------------------------------------
  // Webhook / long-polling
  // ---------------------------------------------------------------------------

  /**
   * Zenzap uses long polling rather than webhooks. This method handles
   * incoming webhook-style requests that a consumer might proxy, or
   * can be skipped in favour of {@link startPolling}.
   */
  async handleWebhook(
    request: Request,
    options?: WebhookOptions,
  ): Promise<Response> {
    const body = await request.text();
    let payload: ZenzapPollingUpdate;

    try {
      payload = JSON.parse(body) as ZenzapPollingUpdate;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    await this.processUpdate(payload, options);
    return new Response("OK", { status: 200 });
  }

  /**
   * Start the long-polling loop to receive updates from Zenzap.
   */
  startPolling(): void {
    if (this.pollingActive) return;
    this.pollingActive = true;
    this.pollingAbortController = new AbortController();
    this.pollLoop();
  }

  /**
   * Stop the long-polling loop.
   */
  stopPolling(): void {
    this.pollingActive = false;
    this.pollingAbortController?.abort();
  }

  private async pollLoop(): Promise<void> {
    // Fetch initial offset without blocking (timeout=0, limit=1)
    try {
      const initial = await this.api.getUpdates(undefined, 1, 0);
      this.pollingOffset = initial.nextOffset;
    } catch (err) {
      this.logger.error("Failed to get initial polling offset", err as Error);
    }

    while (this.pollingActive) {
      try {
        const response = await this.api.getUpdates(
          this.pollingOffset,
          100,
          25,
        );
        this.pollingOffset = response.nextOffset;

        for (const update of response.updates) {
          await this.processUpdate(update);
        }
      } catch (err) {
        if (!this.pollingActive) break;
        this.logger.error("Polling error, retrying in 5s", err as Error);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async processUpdate(
    update: ZenzapPollingUpdate,
    options?: WebhookOptions,
  ): Promise<void> {
    if (!this.chat) return;

    if (update.eventType === "message.created") {
      const raw = update.data as Record<string, unknown>;
      const data = (raw.message ?? raw) as unknown as ZenzapMessage;

      // Skip messages from this bot
      if (data.senderId === this.botUserId) return;

      const threadId = this.encodeThreadId({
        topicId: data.topicId,
      });

      const mentions = data.mentions ?? [];
      const mentionedProfiles = data.mentionedProfiles ?? [];
      const isMention =
        mentions.some((m) => m.id === this.botUserId) ||
        mentionedProfiles.includes(this.botUserId ?? "");

      const factory = async (): Promise<Message<ZenzapMessage>> => {
        const msg = this.parseMessage(data);
        if (isMention) {
          msg.isMention = true;
        }
        return msg;
      };

      this.chat.processMessage(this, threadId, factory, options);
    }
  }

  // ---------------------------------------------------------------------------
  // Message parsing
  // ---------------------------------------------------------------------------

  parseMessage(raw: ZenzapMessage): Message<ZenzapMessage> {
    const attachments: Attachment[] = (raw.attachments ?? []).map((a) => ({
      type: (a.type as Attachment["type"]) ?? "file",
      name: a.name,
      url: a.url,
    }));

    const text = raw.text ?? "";

    return new Message<ZenzapMessage>({
      id: raw.id,
      threadId: this.encodeThreadId({ topicId: raw.topicId }),
      text,
      formatted: this.converter.toAst(text),
      raw,
      author: {
        userId: raw.senderId,
        userName: raw.senderName ?? raw.senderId,
        fullName: raw.senderName ?? "",
        isBot: raw.senderType === "bot",
        isMe: raw.senderId === this.botUserId,
      },
      metadata: {
        dateSent: new Date(raw.createdAt),
        edited: raw.isEdited ?? false,
      },
      attachments,
    });
  }

  // ---------------------------------------------------------------------------
  // Sending messages
  // ---------------------------------------------------------------------------

  async postMessage(
    threadId: string,
    message: AdapterPostableMessage,
  ): Promise<RawMessage<ZenzapMessage>> {
    const { topicId } = this.decodeThreadId(threadId);

    const text = this.converter.renderPostable(message);

    const response = await this.api.sendMessage({
      topicId,
      text,
    });

    return {
      raw: {
        id: response.id,
        topicId: response.topicId,
        text,
        createdAt: response.createdAt,
        updatedAt: response.createdAt,
        senderId: this.botUserId ?? "",
        senderName: this.userName,
        senderType: "bot",
      } satisfies ZenzapMessage,
      id: response.id,
      threadId,
    };
  }

  async editMessage(
    _threadId: string,
    _messageId: string,
    _message: AdapterPostableMessage,
  ): Promise<RawMessage<ZenzapMessage>> {
    throw new ValidationError("zenzap", "Zenzap does not support editing messages");
  }

  async deleteMessage(
    _threadId: string,
    _messageId: string,
  ): Promise<void> {
    throw new ValidationError("zenzap", "Zenzap does not support deleting messages");
  }

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

  async addReaction(
    _threadId: string,
    messageId: string,
    emoji: EmojiValue | string,
  ): Promise<void> {
    const emojiStr = typeof emoji === "string" ? emoji : emoji.name;
    await this.api.addReaction(messageId, emojiStr);
  }

  async removeReaction(
    _threadId: string,
    messageId: string,
    emoji: EmojiValue | string,
  ): Promise<void> {
    const emojiStr = typeof emoji === "string" ? emoji : emoji.name;
    await this.api.removeReaction(messageId, emojiStr);
  }

  // ---------------------------------------------------------------------------
  // Fetching messages & threads
  // ---------------------------------------------------------------------------

  async fetchMessages(
    threadId: string,
    options?: FetchOptions,
  ): Promise<FetchResult<ZenzapMessage>> {
    const { topicId, threadId: subThreadId } = this.decodeThreadId(threadId);

    const isBackward = (options?.direction ?? "backward") === "backward";
    const response = await this.api.getTopicMessages(topicId, {
      limit: options?.limit ?? 50,
      cursor: options?.cursor as string | undefined,
      order: isBackward ? "desc" : "asc",
      threadId: subThreadId,
    });

    const parsed = response.messages.map((m) => this.parseMessage(m));
    // SDK expects chronological order within each page
    const messages = isBackward ? parsed.reverse() : parsed;

    return {
      messages,
      nextCursor: response.nextCursor,
    };
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { topicId } = this.decodeThreadId(threadId);

    try {
      const topic = await this.api.getTopic(topicId);
      return {
        id: threadId,
        channelId: topicId,
        channelName: topic.name,
        metadata: {},
      };
    } catch {
      return {
        id: threadId,
        channelId: topicId,
        metadata: {},
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Channel info
  // ---------------------------------------------------------------------------

  async fetchChannelInfo(channelId: string): Promise<{ id: string; name?: string; metadata: Record<string, unknown> }> {
    try {
      const topic = await this.api.getTopic(channelId);
      return {
        id: channelId,
        name: topic.name,
        metadata: { description: topic.description },
      };
    } catch {
      return { id: channelId, metadata: {} };
    }
  }

  // ---------------------------------------------------------------------------
  // Typing indicator
  // ---------------------------------------------------------------------------

  async startTyping(_threadId: string, _status?: string): Promise<void> {
    // Zenzap API does not expose a typing indicator endpoint
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  renderFormatted(content: FormattedContent): string {
    return this.converter.fromAst(content);
  }

  // ---------------------------------------------------------------------------
  // Optional: DM support
  // ---------------------------------------------------------------------------

  isDM(_threadId: string): boolean {
    return false;
  }
}
