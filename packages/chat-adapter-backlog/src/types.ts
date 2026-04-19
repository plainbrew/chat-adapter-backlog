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
