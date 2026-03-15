/**
 * Decoded components of a Zenzap thread identifier.
 *
 * Zenzap organises conversations into "topics". Messages can optionally
 * be threaded within a topic via a `threadId` (the ID of the root message).
 *
 * Encoded format: `zenzap:{base64url(topicId)}` or
 *                 `zenzap:{base64url(topicId)}:{base64url(threadId)}`
 */
export interface ZenzapThreadId {
  topicId: string;
  threadId?: string;
}

/**
 * Configuration required to connect to the Zenzap API.
 */
export interface ZenzapAdapterConfig {
  /** Zenzap API key (used as Bearer token). */
  apiKey: string;
  /** Zenzap API secret (used for HMAC-SHA256 request signing). */
  apiSecret: string;
  /** Base URL for the Zenzap API. Defaults to "https://api.zenzap.co". */
  baseUrl?: string;
  /** Display name for the bot. */
  userName?: string;
}

// ---------------------------------------------------------------------------
// Zenzap API response types
// ---------------------------------------------------------------------------

export interface ZenzapMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  externalId?: string;
  createdAt: number;
  updatedAt: number;
  status: "Pending" | "Active" | "Deleted" | "Archived";
}

export interface ZenzapTopic {
  id: string;
  name: string;
  description: string;
  type: "topic" | "dm";
  properties: string[];
  members: string[];
  createdAt: number;
  updatedAt: number;
  externalId?: string;
}

export interface ZenzapAttachmentTranscription {
  status?: string;
  text?: string;
}

export interface ZenzapMessageAttachment {
  id?: string;
  type?: string;
  name?: string;
  url?: string;
  transcription?: ZenzapAttachmentTranscription;
}

export interface ZenzapMessageMention {
  id: string;
  name?: string;
  type?: string;
}

export interface ZenzapMessageReaction {
  emoji: string;
  count: number;
  userIds?: string[];
}

export interface ZenzapMessageLink {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

export interface ZenzapMessage {
  id: string;
  topicId: string;
  senderId: string;
  senderName?: string;
  senderType: "user" | "bot" | "system";
  text?: string;
  createdAt: number;
  updatedAt: number;
  isEdited?: boolean;
  isSystem?: boolean;
  replyCount?: number;
  replyToMessageId?: string;
  attachments?: ZenzapMessageAttachment[];
  mentions?: ZenzapMessageMention[];
  mentionedProfiles?: string[];
  reactions?: ZenzapMessageReaction[];
  links?: ZenzapMessageLink[];
}

export interface ZenzapPollingUpdate {
  updateId: string;
  eventType:
    | "message.created"
    | "message.updated"
    | "message.deleted"
    | "reaction.added"
    | "reaction.removed"
    | "member.added"
    | "member.removed"
    | "topic.updated";
  createdAt: number;
  data: Record<string, unknown>;
}

export interface ZenzapUpdatesResponse {
  updates: ZenzapPollingUpdate[];
  nextOffset: string;
}
