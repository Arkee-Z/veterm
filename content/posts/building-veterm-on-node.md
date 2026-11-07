---
title: Building Veterm on Node.js
date: 2026-11-02
description: Replacing Deno with node:http, node:sqlite, and a small Web Request adapter — without losing the terminal-first character of the site.
tags: [node, architecture, terminal]
featured: true
---

Veterm began as a Deno experiment. The site was small, the runtime was pleasant, and `Deno.serve` made the HTTP layer almost disappear. But a blog should outlive its runtime. This post is a short field note on what changed when the engine moved to Node.js.

### The Shape of the Server

The new entry point is deliberately boring:

```js
import { startServer } from "./src/bootstrap.js";

await startServer();
```

Everything below that line is built from Node's standard library. No Express, no bundler, no native addon. The server uses `node:http` for the socket, `node:sqlite` for persistence, and `node:fs/promises` for the content mirror.

### One Adapter, Web Semantics

The routing layer already spoke in Web `Request` and `Response` objects, so the cheapest migration was to preserve that contract. The Node server builds a `Request` from each incoming message and serializes the returned `Response` back to the socket.

```js
const request = await toWebRequest(req, port);
const response = await handleRequest(request);
await sendWebResponse(res, response);
```

That small boundary keeps the API code testable with ordinary `fetch`, while the outer shell stays native Node.

### Why `node:sqlite`

The old build needed a native SQLite module through JSR. On Node, `node:sqlite` is built in. The database layer is still a handful of prepared statements around one `pages` table:

- `path` is unique and human-readable.
- `content` stores the raw markdown or HTML.
- `type` separates markdown, HTML projects, and external links.
- `updated_at` lets the store notice when a file on disk is newer than the index.

The filesystem remains the source of truth. SQLite is a fast read path and a small safety net, not a second copy to maintain by hand.

### The Parts I Kept

The move did not change how the product feels:

1. The terminal still docks above the status bar.
2. Tab completion still understands files and projects.
3. The editor still writes to disk **and** SQLite.
4. Paths are still normalized and validated before any read or write.
5. Markdown is still rendered by a small, dependency-free renderer with sanitization.

### The Parts I Added

- RSS and sitemap generation from the same content index.
- Front matter for titles, dates, descriptions, tags, and featured posts.
- A public `/api/posts` index for the archive, home page, and search.
- Graceful shutdown with `SIGTERM` support.
- A zero-dependency test suite for the renderer and path rules.

### What I Learned

Runtime migrations are mostly about **boundaries**. Moving from Deno to Node was easy because the risky logic — path validation, HTML rendering, session handling — was already isolated. The hard part was resisting the urge to rewrite everything at once.

A blog should be quiet. The runtime should disappear behind the writing. Node makes that disappearing act feel a little more familiar.

---

> The best infrastructure is the kind you forget you are standing on.
