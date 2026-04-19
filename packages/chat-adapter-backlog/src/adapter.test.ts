import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BacklogAdapter } from "./adapter.js";
import type { BacklogComment } from "./backlog-client.js";
import type { BacklogWebhookPayload } from "./types.js";

function makeWebhookRequest(payload: BacklogWebhookPayload): Request {
  return new Request("https://example.com/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function makePayload(overrides?: Partial<BacklogWebhookPayload>): BacklogWebhookPayload {
  return {
    id: 1,
    type: 2,
    project: { id: 10, projectKey: "PROJ", name: "Test Project" },
    content: {
      id: 100,
      key_id: 123,
      summary: "Test issue",
      comment: { id: 200, content: "Hello from Backlog" },
    },
    createdUser: { id: 5, userId: "user1", name: "User One" },
    created: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const adapter = new BacklogAdapter({ host: "myspace.backlog.com", apiKey: "test" });

describe("encodeThreadId / decodeThreadId", () => {
  it("encodes and decodes an issue without commentId", () => {
    const data = { spaceKey: "myspace", projectKey: "PROJ", issueKey: "PROJ-123" };
    const encoded = adapter.encodeThreadId(data);
    expect(encoded).toBe("backlog:myspace:PROJ-123");
    expect(adapter.decodeThreadId(encoded)).toEqual(data);
  });

  it("encodes and decodes an issue with commentId", () => {
    const data = { spaceKey: "myspace", projectKey: "PROJ", issueKey: "PROJ-123", commentId: 456 };
    const encoded = adapter.encodeThreadId(data);
    expect(encoded).toBe("backlog:myspace:PROJ-123:456");
    expect(adapter.decodeThreadId(encoded)).toEqual(data);
  });

  it("round-trips are stable", () => {
    const original = { spaceKey: "my-space", projectKey: "ABC", issueKey: "ABC-1" };
    const decoded = adapter.decodeThreadId(adapter.encodeThreadId(original));
    expect(decoded).toEqual(original);
  });
});

describe("channelIdFromThreadId", () => {
  it("returns projectKey-based channel ID", () => {
    expect(adapter.channelIdFromThreadId("backlog:myspace:PROJ-123")).toBe("backlog:myspace:PROJ");
  });

  it("ignores commentId when deriving channel ID", () => {
    expect(adapter.channelIdFromThreadId("backlog:myspace:PROJ-123:456")).toBe(
      "backlog:myspace:PROJ",
    );
  });
});

describe("handleWebhook", () => {
  it("returns 400 for invalid JSON", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      body: "not-json",
    });
    const response = await adapter.handleWebhook(request);
    expect(response.status).toBe(400);
  });

  it("returns 200 and ignores non-issue-updated event types", async () => {
    const payload = makePayload({ type: 1 });
    const response = await adapter.handleWebhook(makeWebhookRequest(payload));
    expect(response.status).toBe(200);
  });

  it("returns 200 and ignores events without a comment", async () => {
    const payload = makePayload({
      content: { id: 100, key_id: 123, summary: "Test", comment: null },
    });
    const response = await adapter.handleWebhook(makeWebhookRequest(payload));
    expect(response.status).toBe(200);
  });

  it("returns 200 and ignores events with null comment content", async () => {
    const payload = makePayload({
      content: { id: 100, key_id: 123, summary: "Test", comment: { id: 200, content: null } },
    });
    const response = await adapter.handleWebhook(makeWebhookRequest(payload));
    expect(response.status).toBe(200);
  });

  it("calls chat.processMessage with the correct message on comment event", async () => {
    const processMessage = vi.fn();
    const adapterWithChat = new BacklogAdapter({ host: "myspace.backlog.com", apiKey: "test" });
    await adapterWithChat.initialize({ processMessage } as never);

    const payload = makePayload();
    const response = await adapterWithChat.handleWebhook(makeWebhookRequest(payload));

    expect(response.status).toBe(200);
    expect(processMessage).toHaveBeenCalledOnce();

    const [, threadId, message] = processMessage.mock.calls[0];
    expect(threadId).toBe("backlog:myspace:PROJ-123");
    expect(message.id).toBe("200");
    expect(message.text).toBe("Hello from Backlog");
    expect(message.threadId).toBe("backlog:myspace:PROJ-123");
    expect(message.author.userId).toBe("5");
    expect(message.author.userName).toBe("user1");
    expect(message.author.fullName).toBe("User One");
    expect(message.author.isBot).toBe(false);
  });

  it("converts Backlog markup to markdown AST in message.formatted", async () => {
    const processMessage = vi.fn();
    const adapterWithChat = new BacklogAdapter({ host: "myspace.backlog.com", apiKey: "test" });
    await adapterWithChat.initialize({ processMessage } as never);

    const payload = makePayload({
      content: {
        id: 100,
        key_id: 123,
        summary: "Test",
        comment: { id: 200, content: "''bold text''" },
      },
    });
    await adapterWithChat.handleWebhook(makeWebhookRequest(payload));

    const [, , message] = processMessage.mock.calls[0];
    expect(message.text).toBe("bold text");
  });

  it("does not call chat.processMessage when chat is not initialized", async () => {
    const payload = makePayload();
    const response = await adapter.handleWebhook(makeWebhookRequest(payload));
    expect(response.status).toBe(200);
  });
});

function makeComment(overrides?: Partial<BacklogComment>): BacklogComment {
  return {
    id: 10,
    content: "Hello",
    created: "2024-01-01T00:00:00Z",
    updated: "2024-01-01T00:00:00Z",
    createdUser: { id: 5, userId: "user1", name: "User One" },
    ...overrides,
  };
}

describe("fetchMessages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns messages in chronological order (backward, default)", async () => {
    const comments = [
      makeComment({ id: 30, content: "newest" }),
      makeComment({ id: 20, content: "middle" }),
      makeComment({ id: 10, content: "oldest" }),
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(comments), { status: 200 }),
    );

    const result = await adapter.fetchMessages("backlog:myspace:PROJ-123");

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].id).toBe("10");
    expect(result.messages[1].id).toBe("20");
    expect(result.messages[2].id).toBe("30");
    expect(result.messages[0].text).toBe("oldest");
  });

  it("passes order=desc and count to the API for backward direction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await adapter.fetchMessages("backlog:myspace:PROJ-123", { direction: "backward", limit: 50 });

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("order=desc");
    expect(url).toContain("count=50");
  });

  it("passes order=asc and count to the API for forward direction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await adapter.fetchMessages("backlog:myspace:PROJ-123", { direction: "forward", limit: 10 });

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("order=asc");
    expect(url).toContain("count=10");
  });

  it("passes maxId when cursor is provided for backward direction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await adapter.fetchMessages("backlog:myspace:PROJ-123", { cursor: "100" });

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("maxId=99");
  });

  it("passes minId when cursor is provided for forward direction", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await adapter.fetchMessages("backlog:myspace:PROJ-123", { direction: "forward", cursor: "50" });

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain("minId=51");
  });

  it("sets nextCursor when result count equals limit", async () => {
    const comments = [makeComment({ id: 20 }), makeComment({ id: 10 })];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(comments), { status: 200 }),
    );

    const result = await adapter.fetchMessages("backlog:myspace:PROJ-123", { limit: 2 });

    expect(result.nextCursor).toBe("10");
  });

  it("does not set nextCursor when result count is less than limit", async () => {
    const comments = [makeComment({ id: 10 })];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(comments), { status: 200 }),
    );

    const result = await adapter.fetchMessages("backlog:myspace:PROJ-123", { limit: 10 });

    expect(result.nextCursor).toBeUndefined();
  });

  it("filters out comments with null content", async () => {
    const comments = [
      makeComment({ id: 30, content: "visible" }),
      makeComment({ id: 20, content: null }),
      makeComment({ id: 10, content: "also visible" }),
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(comments), { status: 200 }),
    );

    const result = await adapter.fetchMessages("backlog:myspace:PROJ-123");

    expect(result.messages).toHaveLength(2);
  });

  it("maps comment fields to message author and metadata", async () => {
    const comment = makeComment({
      id: 42,
      content: "test",
      created: "2024-03-01T10:00:00Z",
      updated: "2024-03-01T12:00:00Z",
      createdUser: { id: 7, userId: "bob", name: "Bob Smith" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([comment]), { status: 200 }),
    );

    const result = await adapter.fetchMessages("backlog:myspace:PROJ-123");

    const msg = result.messages[0];
    expect(msg.id).toBe("42");
    expect(msg.author.userId).toBe("7");
    expect(msg.author.userName).toBe("bob");
    expect(msg.author.fullName).toBe("Bob Smith");
    expect(msg.metadata.edited).toBe(true);
    expect(msg.raw).toEqual(comment);
  });
});
