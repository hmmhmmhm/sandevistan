export type XAuthor = {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl?: string;
};

export type XMedia = {
  readonly id: string;
  readonly kind: "photo" | "video" | "animated_gif";
  readonly url?: string;
};

export type XPost = {
  readonly id: string;
  readonly text: string;
  readonly createdAt?: string;
  readonly author: XAuthor;
  readonly media: readonly XMedia[];
};

export type XTimeline = {
  readonly posts: readonly XPost[];
  readonly next?: string;
};

type XTimelineResponse = {
  readonly data?: readonly {
    readonly id: string;
    readonly text: string;
    readonly created_at?: string;
    readonly author_id?: string;
    readonly attachments?: { readonly media_keys?: readonly string[] };
  }[];
  readonly includes?: {
    readonly users?: readonly {
      readonly id: string;
      readonly name?: string;
      readonly username?: string;
      readonly profile_image_url?: string;
    }[];
    readonly media?: readonly {
      readonly media_key: string;
      readonly type: XMedia["kind"];
      readonly url?: string;
      readonly preview_image_url?: string;
    }[];
  };
  readonly meta?: { readonly next_token?: string };
};

const headers = (token: string) => ({ authorization: `Bearer ${token}` });
import { DEFAULT_X_RELAY_URL } from "./x-key";

const X_API_ORIGIN = DEFAULT_X_RELAY_URL;
const apiUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;

export class XApiError extends Error {
  constructor(
    readonly reason: "network" | "auth" | "profile" | "timeline",
    readonly status?: number,
  ) {
    super(`x_${reason}${status ? `_${status}` : ""}`);
  }
}

const request = async (
  url: string,
  token: string,
  fetchImpl: typeof fetch,
) => {
  try {
    return await fetchImpl(url, { headers: headers(token) });
  } catch {
    throw new XApiError("network");
  }
};

export async function resolveXUserId(
  token: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl = X_API_ORIGIN,
): Promise<string> {
  const response = await request(apiUrl(baseUrl, "/2/users/me"), token, fetchImpl);
  if (!response.ok) throw new XApiError("auth", response.status);
  const json = await response.json() as { data?: { id?: string } };
  if (!json.data?.id) throw new XApiError("profile");
  return json.data.id;
}

export async function fetchXHomeTimeline(
  token: string,
  userId: string,
  page?: string,
  fetchImpl: typeof fetch = fetch,
  baseUrl = X_API_ORIGIN,
): Promise<XTimeline> {
  const params = new URLSearchParams({
    max_results: "10",
    expansions: "author_id,attachments.media_keys",
    "tweet.fields": "created_at,author_id,attachments",
    "user.fields": "name,username,profile_image_url",
    "media.fields": "url,preview_image_url,type",
  });
  if (page) params.set("pagination_token", page);
  const response = await request(
    apiUrl(baseUrl, `/2/users/${encodeURIComponent(userId)}/timelines/reverse_chronological?${params}`),
    token,
    fetchImpl,
  );
  if (!response.ok) throw new XApiError("timeline", response.status);
  const json = await response.json() as XTimelineResponse;
  const authors = new Map((json.includes?.users ?? []).map((author) => [author.id, author]));
  const media = new Map((json.includes?.media ?? []).map((item) => [item.media_key, item]));
  return {
    posts: (json.data ?? []).map((tweet) => {
      const author = tweet.author_id ? authors.get(tweet.author_id) : undefined;
      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        author: {
          id: author?.id ?? tweet.author_id ?? "unknown",
          name: author?.name ?? "X",
          username: author?.username ?? "unknown",
          avatarUrl: author?.profile_image_url,
        },
        media: (tweet.attachments?.media_keys ?? []).flatMap((key) => {
          const item = media.get(key);
          return item ? [{
            id: item.media_key,
            kind: item.type,
            url: item.url ?? item.preview_image_url,
          }] : [];
        }),
      };
    }),
    next: json.meta?.next_token,
  };
}
