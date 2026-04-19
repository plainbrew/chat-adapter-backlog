import { describe, expect, it, vi } from "vitest";

import { BacklogAdapter } from "./adapter.js";
import { BacklogClient } from "./backlog-client.js";

vi.mock("./backlog-client.js");

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

describe("fetchThread", () => {
  const mockIssue = {
    id: 1,
    issueKey: "PROJ-123",
    summary: "Test Issue",
    description: "desc",
    created: "2024-01-01T00:00:00Z",
    updated: "2024-01-02T00:00:00Z",
    createdUser: { id: 1, userId: "user1", name: "User One" },
  };

  it("returns ThreadInfo for an issue thread", async () => {
    vi.mocked(BacklogClient.prototype.getIssue).mockResolvedValue(mockIssue);

    const result = await adapter.fetchThread("backlog:myspace:PROJ-123");
    expect(result).toEqual({
      id: "backlog:myspace:PROJ-123",
      channelId: "backlog:myspace:PROJ",
      channelName: "PROJ",
      metadata: {
        issueKey: "PROJ-123",
        summary: "Test Issue",
        issue: mockIssue,
      },
    });
    expect(BacklogClient.prototype.getIssue).toHaveBeenCalledWith("PROJ-123");
  });

  it("returns ThreadInfo for a comment thread", async () => {
    vi.mocked(BacklogClient.prototype.getIssue).mockResolvedValue(mockIssue);

    const result = await adapter.fetchThread("backlog:myspace:PROJ-123:456");
    expect(result).toEqual({
      id: "backlog:myspace:PROJ-123:456",
      channelId: "backlog:myspace:PROJ",
      channelName: "PROJ",
      metadata: {
        issueKey: "PROJ-123",
        summary: "Test Issue",
        issue: mockIssue,
      },
    });
    expect(BacklogClient.prototype.getIssue).toHaveBeenCalledWith("PROJ-123");
  });
});
