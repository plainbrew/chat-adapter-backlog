import {
  type Adapter,
  type AdapterPostableMessage,
  type ChatInstance,
  type EmojiValue,
  type FetchOptions,
  type FetchResult,
  type FormattedContent,
  type Message,
  NotImplementedError,
  type RawMessage,
  type ThreadInfo,
} from "chat";

import { BacklogFormatConverter } from "./format-converter.js";
import type { BacklogConfig, BacklogThreadId } from "./types.js";

export class BacklogAdapter implements Adapter<BacklogThreadId, unknown> {
  readonly name = "backlog";
  readonly userName: string;

  private config: BacklogConfig;
  private formatConverter: BacklogFormatConverter;
  protected chat?: ChatInstance;

  constructor(config: BacklogConfig) {
    this.config = config;
    this.userName = config.userName ?? "Backlog Bot";
    this.formatConverter = new BacklogFormatConverter();
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

  async fetchMessages(_threadId: string, _options?: FetchOptions): Promise<FetchResult<unknown>> {
    throw new NotImplementedError("fetchMessages is not yet implemented", "fetchMessages");
  }

  async fetchThread(_threadId: string): Promise<ThreadInfo> {
    throw new NotImplementedError("fetchThread is not yet implemented", "fetchThread");
  }

  async handleWebhook(_request: Request): Promise<Response> {
    throw new NotImplementedError("handleWebhook is not yet implemented", "handleWebhook");
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
