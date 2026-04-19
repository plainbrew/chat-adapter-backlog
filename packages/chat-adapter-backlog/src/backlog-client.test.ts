import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BacklogApiError, BacklogClient } from "./backlog-client.js";

const HOST = "example.backlog.com";
const API_KEY = "test-api-key";

function makeClient() {
  return new BacklogClient(HOST, API_KEY);
}

function mockFetch(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(status === 204 ? null : JSON.stringify(body), { status }));
}

function capturedUrl(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls[0][0] as string;
}

describe("BacklogClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getIssue", () => {
    it("calls GET /issues/:key with apiKey", async () => {
      const issue = {
        id: 1,
        issueKey: "PROJ-1",
        summary: "test",
        description: null,
        created: "",
        updated: "",
        createdUser: { id: 1, userId: "u", name: "User" },
      };
      const spy = mockFetch(issue);

      const client = makeClient();
      const result = await client.getIssue("PROJ-1");

      expect(result).toEqual(issue);
      expect(capturedUrl(spy)).toContain(`/issues/PROJ-1`);
      expect(capturedUrl(spy)).toContain(`apiKey=${API_KEY}`);
    });

    it("throws BacklogApiError on 404", async () => {
      mockFetch({ message: "not found" }, 404);

      await expect(makeClient().getIssue("PROJ-999")).rejects.toBeInstanceOf(BacklogApiError);
    });
  });

  describe("getComments", () => {
    it("calls GET /issues/:key/comments", async () => {
      const comments = [
        {
          id: 10,
          content: "hello",
          created: "",
          updated: "",
          createdUser: { id: 1, userId: "u", name: "User" },
        },
      ];
      const spy = mockFetch(comments);

      const result = await makeClient().getComments("PROJ-1");

      expect(result).toEqual(comments);
      expect(capturedUrl(spy)).toContain(`/issues/PROJ-1/comments`);
    });

    it("appends query params when options are provided", async () => {
      const spy = mockFetch([]);

      await makeClient().getComments("PROJ-1", { order: "desc", count: 50, maxId: 99 });

      const url = capturedUrl(spy);
      expect(url).toContain("order=desc");
      expect(url).toContain("count=50");
      expect(url).toContain("maxId=99");
    });

    it("omits query params not in options", async () => {
      const spy = mockFetch([]);

      await makeClient().getComments("PROJ-1", { order: "asc" });

      const url = capturedUrl(spy);
      expect(url).toContain("order=asc");
      expect(url).not.toContain("minId");
      expect(url).not.toContain("maxId");
      expect(url).not.toContain("count");
    });
  });

  describe("postComment", () => {
    it("calls POST /issues/:key/comments with content in body", async () => {
      const comment = {
        id: 11,
        content: "new comment",
        created: "",
        updated: "",
        createdUser: { id: 1, userId: "u", name: "User" },
      };
      const spy = mockFetch(comment);

      const result = await makeClient().postComment("PROJ-1", "new comment");

      expect(result).toEqual(comment);
      const call = spy.mock.calls[0];
      expect((call[1] as RequestInit).method).toBe("POST");
      expect((call[1] as RequestInit).body).toContain("content=new+comment");
    });
  });

  describe("updateComment", () => {
    it("calls PATCH /issues/:key/comments/:id", async () => {
      const comment = {
        id: 11,
        content: "updated",
        created: "",
        updated: "",
        createdUser: { id: 1, userId: "u", name: "User" },
      };
      const spy = mockFetch(comment);

      const result = await makeClient().updateComment("PROJ-1", 11, "updated");

      expect(result).toEqual(comment);
      const call = spy.mock.calls[0];
      expect((call[1] as RequestInit).method).toBe("PATCH");
      expect(capturedUrl(spy)).toContain(`/issues/PROJ-1/comments/11`);
    });
  });

  describe("deleteComment", () => {
    it("calls DELETE /issues/:key/comments/:id and returns undefined", async () => {
      const spy = mockFetch(null, 204);

      const result = await makeClient().deleteComment("PROJ-1", 11);

      expect(result).toBeUndefined();
      const call = spy.mock.calls[0];
      expect((call[1] as RequestInit).method).toBe("DELETE");
      expect(capturedUrl(spy)).toContain(`/issues/PROJ-1/comments/11`);
    });

    it("throws BacklogApiError on 403", async () => {
      mockFetch({ message: "forbidden" }, 403);

      await expect(makeClient().deleteComment("PROJ-1", 11)).rejects.toBeInstanceOf(
        BacklogApiError,
      );
    });
  });

  describe("BacklogApiError", () => {
    it("has correct status and name", async () => {
      mockFetch({}, 500);

      const err = await makeClient()
        .getIssue("PROJ-1")
        .catch((e) => e);
      expect(err).toBeInstanceOf(BacklogApiError);
      expect(err.status).toBe(500);
      expect(err.name).toBe("BacklogApiError");
    });
  });
});
