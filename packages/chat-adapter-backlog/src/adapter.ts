import {
  type Adapter,
  type AdapterPostableMessage,
  type ChatInstance,
  type EmojiValue,
  type FetchOptions,
  type FetchResult,
  type FormattedContent,
  Message,
  NotImplementedError,
  type RawMessage,
  type ThreadInfo,
  type WebhookOptions,
  toPlainText,
} from "chat";

import { BacklogClient, type BacklogComment, type GetCommentsOptions } from "./backlog-client.js";
import { BacklogFormatConverter } from "./format-converter.js";
import type { BacklogConfig, BacklogThreadId, BacklogWebhookPayload } from "./types.js";

const BACKLOG_ACTIVITY_TYPE_ISSUE_UPDATED = 2;

export class BacklogAdapter implements Adapter<BacklogThreadId, unknown> {
  readonly name = "backlog";
  readonly userName: string;

  private config: BacklogConfig;
  private formatConverter: BacklogFormatConverter;
  private client: BacklogClient;
  protected chat?: ChatInstance;

  constructor(config: BacklogConfig) {
    this.config = config;
    this.userName = config.userName ?? "Backlog Bot";
    this.formatConverter = new BacklogFormatConverter();
    this.client = new BacklogClient(config.host, config.apiKey);
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
  }

  encodeThreadId(platformData: BacklogThreadId): string {
    const base = `backlog:${platformData.spaceKey}:${platformData.issueKey}`;
    return platformData.commentId != null ? `${base}:${platformData.commentId}` : base;
  }

  decodeThreadId(threadId: string): BacklogThreadId {
    const parts = threadId.split(":");
    if (parts.length < 3 || parts[0] !== "backlog") {
      throw new Error(`Invalid Backlog thread ID: ${threadId}`);
    }
    const spaceKey = parts[1];
    const issueKey = parts[2];
    const projectKey = issueKey.split("-")[0];
    const commentId = parts[3] != null ? Number(parts[3]) : undefined;
    return { spaceKey, projectKey, issueKey, commentId };
  }

  channelIdFromThreadId(threadId: string): string {
    const { spaceKey, projectKey } = this.decodeThreadId(threadId);
    return `backlog:${spaceKey}:${projectKey}`;
  }

  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content);
  }

  async addReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string,
  ): Promise<void> {
    throw new NotImplementedError("Reactions are not supported in Backlog", "addReaction");
  }

  async deleteMessage(_threadId: string, _messageId: string): Promise<void> {
    throw new NotImplementedError("deleteMessage is not yet implemented", "deleteMessage");
  }

  async editMessage(
    _threadId: string,
    _messageId: string,
    _message: AdapterPostableMessage,
  ): Promise<RawMessage<unknown>> {
    throw new NotImplementedError("editMessage is not yet implemented", "editMessage");
  }

  async fetchMessages(threadId: string, options?: FetchOptions): Promise<FetchResult<unknown>> {
    const { issueKey } = this.decodeThreadId(threadId);
    const direction = options?.direction ?? "backward";
    const limit = Math.min(options?.limit ?? 100, 100);
    const cursor = options?.cursor;

    const query: GetCommentsOptions = {
      count: limit,
      order: direction === "backward" ? "desc" : "asc",
    };

    if (cursor != null) {
      const cursorId = parseInt(cursor, 10);
      if (direction === "backward") {
        query.maxId = cursorId - 1;
      } else {
        query.minId = cursorId + 1;
      }
    }

    const comments = await this.client.getComments(issueKey, query);
    const validComments = comments.filter(
      (c): c is BacklogComment & { content: string } => c.content != null,
    );

    // backward: API returns newest-first (desc); reverse to chronological order
    const chronological = direction === "backward" ? [...validComments].reverse() : validComments;

    const messages = chronological.map((comment) => {
      const formatted = this.formatConverter.toAst(comment.content);
      return new Message({
        id: String(comment.id),
        threadId,
        text: toPlainText(formatted),
        formatted,
        raw: comment,
        author: {
          userId: String(comment.createdUser.id),
          userName: comment.createdUser.userId,
          fullName: comment.createdUser.name,
          isBot: false,
          isMe: false,
        },
        metadata: {
          dateSent: new Date(comment.created),
          edited: comment.created !== comment.updated,
        },
        attachments: [],
      });
    });

    // nextCursor is the ID of the last element in the raw API response
    // backward (desc order): last = oldest → cursor for even older messages via maxId
    // forward (asc order): last = newest → cursor for even newer messages via minId
    let nextCursor: string | undefined;
    if (comments.length >= limit && comments.length > 0) {
      nextCursor = String(comments[comments.length - 1].id);
    }

    return { messages, nextCursor };
  }

  async fetchThread(_threadId: string): Promise<ThreadInfo> {
    throw new NotImplementedError("fetchThread is not yet implemented", "fetchThread");
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    let payload: BacklogWebhookPayload;
    try {
      payload = (await request.json()) as BacklogWebhookPayload;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (
      payload.type !== BACKLOG_ACTIVITY_TYPE_ISSUE_UPDATED ||
      !payload.content?.comment?.content
    ) {
      return new Response(null, { status: 200 });
    }

    const spaceKey = this.config.host.split(".")[0];
    const projectKey = payload.project.projectKey;
    const issueKey = `${projectKey}-${payload.content.key_id}`;
    const threadId = this.encodeThreadId({ spaceKey, projectKey, issueKey });

    const comment = payload.content.comment;
    // content is verified non-null by the guard above
    const formatted = this.formatConverter.toAst(comment.content!);

    const message = new Message({
      id: String(comment.id),
      threadId,
      text: toPlainText(formatted),
      formatted,
      raw: payload,
      author: {
        userId: String(payload.createdUser.id),
        userName: payload.createdUser.userId,
        fullName: payload.createdUser.name,
        isBot: false,
        isMe: false,
      },
      metadata: {
        dateSent: new Date(payload.created),
        edited: false,
      },
      attachments: [],
    });

    this.chat?.processMessage(this, threadId, message, options);

    return new Response(null, { status: 200 });
  }

  parseMessage(_raw: unknown): Message<unknown> {
    throw new NotImplementedError("parseMessage is not yet implemented", "parseMessage");
  }

  async postMessage(
    _threadId: string,
    _message: AdapterPostableMessage,
  ): Promise<RawMessage<unknown>> {
    throw new NotImplementedError("postMessage is not yet implemented", "postMessage");
  }

  async removeReaction(
    _threadId: string,
    _messageId: string,
    _emoji: EmojiValue | string,
  ): Promise<void> {
    throw new NotImplementedError("Reactions are not supported in Backlog", "removeReaction");
  }

  async startTyping(_threadId: string): Promise<void> {
    // Backlog does not support typing indicators
  }
}
