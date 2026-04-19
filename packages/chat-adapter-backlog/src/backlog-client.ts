export interface BacklogUser {
  id: number;
  userId: string;
  name: string;
}

export interface BacklogIssue {
  id: number;
  issueKey: string;
  summary: string;
  description: string | null;
  created: string;
  updated: string;
  createdUser: BacklogUser;
}

export interface BacklogComment {
  id: number;
  content: string | null;
  created: string;
  updated: string;
  createdUser: BacklogUser;
}

export class BacklogApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BacklogApiError";
  }
}

export class BacklogClient {
  private readonly baseUrl: string;

  constructor(
    private readonly host: string,
    private readonly apiKey: string,
  ) {
    this.baseUrl = `https://${host}/api/v2`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("apiKey", this.apiKey);

    const init: RequestInit = { method };
    if (body) {
      init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
      init.body = new URLSearchParams(body).toString();
    }

    const res = await fetch(url.toString(), init);
    if (!res.ok) {
      throw new BacklogApiError(res.status, `Backlog API error: ${res.status} ${res.statusText}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  getIssue(issueIdOrKey: string): Promise<BacklogIssue> {
    return this.request<BacklogIssue>("GET", `/issues/${encodeURIComponent(issueIdOrKey)}`);
  }

  getComments(issueIdOrKey: string): Promise<BacklogComment[]> {
    return this.request<BacklogComment[]>(
      "GET",
      `/issues/${encodeURIComponent(issueIdOrKey)}/comments`,
    );
  }

  postComment(issueIdOrKey: string, content: string): Promise<BacklogComment> {
    return this.request<BacklogComment>(
      "POST",
      `/issues/${encodeURIComponent(issueIdOrKey)}/comments`,
      { content },
    );
  }

  updateComment(issueIdOrKey: string, commentId: number, content: string): Promise<BacklogComment> {
    return this.request<BacklogComment>(
      "PATCH",
      `/issues/${encodeURIComponent(issueIdOrKey)}/comments/${commentId}`,
      { content },
    );
  }

  deleteComment(issueIdOrKey: string, commentId: number): Promise<void> {
    return this.request<void>(
      "DELETE",
      `/issues/${encodeURIComponent(issueIdOrKey)}/comments/${commentId}`,
    );
  }
}
