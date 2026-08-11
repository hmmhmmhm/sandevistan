import type { PhoneStringKey } from "../phone-i18n";
import type { XPost } from "../x-feed";

const dateLabel = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat(
    undefined,
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  ).format(date);
};

function XPostCard({ post }: { readonly post: XPost }) {
  const label = dateLabel(post.createdAt);
  return (
    <article className="phone-x-post">
      <header className="phone-x-post__header">
        {post.author.avatarUrl ? (
          <img className="phone-x-post__avatar" src={post.author.avatarUrl} alt="" />
        ) : <span className="phone-x-post__avatar phone-x-post__avatar--fallback">𝕏</span>}
        <div>
          <strong>{post.author.name}</strong>
          <span>@{post.author.username}{label ? ` · ${label}` : ""}</span>
        </div>
      </header>
      <p>{post.text}</p>
      {post.media.map((media) => media.url ? (
        <img
          key={media.id}
          className="phone-x-post__media"
          src={media.url}
          alt={media.kind === "photo" ? "Attached post media" : "Attached media preview"}
          loading="lazy"
        />
      ) : null)}
    </article>
  );
}

export function XScreen({
  configured,
  posts,
  loading,
  error,
  canLoadMore,
  t,
  onLoadMore,
}: {
  readonly configured: boolean;
  readonly posts: readonly XPost[];
  readonly loading: boolean;
  readonly error?: string;
  readonly canLoadMore: boolean;
  readonly t: (key: PhoneStringKey) => string;
  readonly onLoadMore: () => void;
}) {
  if (!configured) {
    return (
      <section className="phone-panel phone-x-empty">
        <h2>X (Twitter)</h2>
        <p>Add an OAuth 2.0 access token in BYOK Keys to read your Home timeline.</p>
        <p className="phone-form-message">Required scopes: tweet.read and users.read.</p>
      </section>
    );
  }
  return (
    <section className="phone-x-feed" aria-busy={loading || undefined}>
      <div className="phone-x-feed__title">
        <div><h2>X (Twitter)</h2><p>Your Home timeline · direct from X</p></div>
        {loading && <span>Loading…</span>}
      </div>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="phone-x-empty">No posts available in this timeline.</p>
      )}
      {posts.map((post) => <XPostCard key={post.id} post={post} />)}
      {canLoadMore && (
        <button type="button" className="phone-primary-button" onClick={onLoadMore} disabled={loading}>
          Load 10 more
        </button>
      )}
    </section>
  );
}
