import { describe, expect, it, vi } from "vitest";

import { BacklogAdapter } from "./adapter.js";
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
