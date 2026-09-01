# Agent API (MCP Server)

The feedback tool exposes a remote MCP server so AI agents can read apps,
version plans, and feedback directly.

- Endpoint: `https://<project-ref>.supabase.co/functions/v1/mcp-server`
- Transport: MCP streamable HTTP (stateless), POST only
- Auth: `Authorization: Bearer fvt_...` — create tokens as an admin under
  Admin > API Tokens. The token is shown exactly once; revoke it there too.

## Connect

Claude Code (run inside any project that should use the data):

    claude mcp add --transport http feature-voting \
      https://<project-ref>.supabase.co/functions/v1/mcp-server \
      --header "Authorization: Bearer fvt_..."

claude.ai / cloud agents: add a custom connector with the same URL and header.

## Tools

### list_apps
No arguments. Returns all apps: `id`, `name`, `slug`, `description`,
`platforms`. Use `slug` as the `app` argument everywhere else.

### get_version_plan
Arguments: `app` (slug), `version` (semver, e.g. `1.3.0`).
Returns the release (`semver`, `title`, `notes`), its per-platform state
(`platform`, `version`, `status` planned/released, `released_at`), and every
feedback item assigned to the version with full descriptions and the
platforms it targets. Unknown versions return the list of valid versions.

Typical use: "Implement everything planned for 1.3.0" — the agent calls
`get_version_plan` and works through the items without further explanation.

### list_feedback
Arguments: `app` (slug), optional `status`
(`open|planned|progress|completed|wont_do`), optional `type` (`feature|bug`).
Returns matching items with full descriptions, newest first.

Typical use: scan `status=open` items for duplicates of each other or for
bugs that are already fixed in the codebase.

### get_feedback
Arguments: `id` (uuid). Returns one item plus its comments
(`content`, `is_admin`, `created_at`) and attachment image URLs.
This is also how agents read a ticket's comment thread.

### update_status
Arguments: `id` (uuid), `status`
(`open|planned|progress|completed|wont_do`).
Changes the item's status — e.g. mark a bug `completed` after fixing it, or
move an implemented feature out of `progress`. If the submitter opted into
notifications, the same status-change email is sent as when an admin changes
the status in the UI; the response includes `notified` accordingly.

### set_version
Arguments: `id` (feedback uuid), `version` (semver of an **existing** release of
the item's app), optional `platforms` (array of the app's platform names or
`all`).
Assigns the item to the release the way the admin UI's release picker does:
one release target per platform, the release's platform row kept (a released
platform stays released), and the legacy `version` column mirrored. Platform
default when `platforms` is omitted: every platform of the app for a
`feature`, the item's own platform for a `bug`. An unknown version is refused
and the existing versions are listed — releases are created in the admin UI,
never by an agent. Does not change the status and sends no e-mail; combine
with `update_status` for "shipped in 1.3.0".

### add_comment
Arguments: `id` (uuid), `content` (max 5000 chars).
Posts an admin comment on the item — e.g. explain what was fixed, or ask the
reporter for more detail. Opted-in submitters and commenters receive the same
emails as for admin comments written in the UI; the response includes
`notifications_sent`.

## Notes

- Responses are JSON in a text content block.
- Submitter and commenter email addresses are never included.
- Tokens grant read access plus status-update and comment write access.
