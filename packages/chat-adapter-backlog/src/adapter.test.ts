import { describe, expect, it } from "vitest";

import { BacklogAdapter } from "./adapter.js";

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
