import type { BacklogComment } from "./backlog-client.js";

export type { BacklogComment };

export interface BacklogRawMessage {
  comment: BacklogComment;
  issueKey: string;
  spaceKey: string;
  projectKey: string;
}

export interface BacklogWebhookUser {
  id: number;
  userId: string;
  name: string;
}

export interface BacklogWebhookComment {
  id: number;
  content: string | null;
}

export interface BacklogWebhookContent {
  id: number;
  key_id: number;
  summary: string;
  comment: BacklogWebhookComment | null;
}

export interface BacklogWebhookProject {
  id: number;
  projectKey: string;
  name: string;
}

export interface BacklogWebhookPayload {
  id: number;
  type: number;
  project: BacklogWebhookProject;
  content: BacklogWebhookContent;
  createdUser: BacklogWebhookUser;
  created: string;
}

export interface BacklogThreadId {
  /** Backlog space key (e.g., "myspace" in myspace.backlog.com) */
  spaceKey: string;
  /** Project key (e.g., "PROJ") */
  projectKey: string;
  /** Issue key (e.g., "PROJ-123") */
  issueKey: string;
  /** Comment ID for thread context */
  commentId?: number;
}

export interface BacklogConfig {
  /** Backlog space host (e.g., "myspace.backlog.com") */
  host: string;
  /** Backlog API key */
  apiKey: string;
  /** Optional display name for the bot */
  userName?: string;
}
