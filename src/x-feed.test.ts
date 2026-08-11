import { describe, expect, it, vi } from "vitest";
import { fetchXHomeTimeline, resolveXUserId } from "./x-feed";
import { DEFAULT_X_RELAY_URL } from "./x-key";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("X home timeline", () => {
  it("uses OAuth bearer credentials and maps authors, photos, and the next page", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ data: { id: "me" } }))
      .mockResolvedValueOnce(response({
        data: [{
          id: "tweet-1",
          text: "Hello from X",
          created_at: "2026-08-11T00:00:00.000Z",
          author_id: "author-1",
          attachments: { media_keys: ["media-1"] },
        }],
        includes: {
          users: [{ id: "author-1", name: "Ada", username: "ada", profile_image_url: "https://image.test/avatar.jpg" }],
          media: [{ media_key: "media-1", type: "photo", url: "https://image.test/photo.jpg" }],
        },
        meta: { next_token: "page-2" },
      }));

    const userId = await resolveXUserId("token-for-test", fetchMock);
    const timeline = await fetchXHomeTimeline("token-for-test", userId, undefined, fetchMock);

    expect(userId).toBe("me");
    expect(fetchMock.mock.calls[0]?.[0]).toContain(DEFAULT_X_RELAY_URL);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ headers: { authorization: "Bearer token-for-test" } });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/users/me/timelines/reverse_chronological?");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("max_results=10");
    expect(timeline).toEqual({
      posts: [{
        id: "tweet-1",
        text: "Hello from X",
        createdAt: "2026-08-11T00:00:00.000Z",
        author: { id: "author-1", name: "Ada", username: "ada", avatarUrl: "https://image.test/avatar.jpg" },
        media: [{ id: "media-1", kind: "photo", url: "https://image.test/photo.jpg" }],
      }],
      next: "page-2",
    });
  });

  it("passes the pagination token when requesting another ten posts", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response({ data: [] }));
    await fetchXHomeTimeline("token-for-test", "me", "next-page", fetchMock);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("pagination_token=next-page");
  });

  it("uses a configured X-only relay as the API base URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response({ data: [] }));
    await fetchXHomeTimeline("token-for-test", "me", undefined, fetchMock, "https://relay.example/");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("https://relay.example/2/users/me/timelines");
  });

  it("keeps the HTTP status for an actionable OAuth error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 401 }));
    await expect(resolveXUserId("token-for-test", fetchMock)).rejects.toMatchObject({
      reason: "auth",
      status: 401,
    });
  });
});
