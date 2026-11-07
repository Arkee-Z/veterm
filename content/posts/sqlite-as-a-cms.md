---
title: SQLite as a CMS
date: 2026-09-27
description: Treating a single SQLite table as an index over a folder of markdown files — and why database-first does not have to mean database-only.
tags: [sqlite, data, architecture]
---

Most personal blogs do not need a CMS. They need a folder of files, a renderer, and a way to find things. Veterm adds a database to that list, but not because the database is the source of truth.

### Files First, Database Second

The `content/` directory is still the thing you can back up, grep, and read on a plane. SQLite exists for speed and structure:

- list all posts without walking every directory;
- keep an `updated_at` value for cache invalidation;
- search titles, tags, and excerpts without parsing markdown on every request.

When the two disagree, the disk wins. If a file's modification time is newer than its row, the store reads the file and re-indexes it.

```text
content/posts/hello-world.md  ──┐
                                 ├── read / normalize ──> SQLite index
content/projects/lab/index.html ─┘
```

### One Table Is Enough

The schema is almost embarrassing:

```sql
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'md',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Pages, posts, projects, external links, and metadata files all live in the same table. The `path` is the identity. The `type` is the only routing hint the store needs.

### The Index Is a Projection

Front matter gives the reading UI the metadata it needs:

```yaml
---
title: SQLite as a CMS
date: 2026-09-27
tags: [sqlite, data, architecture]
description: A single-table CMS over a folder of markdown.
featured: false
---
```

The public index combines those fields with derived values — reading time, excerpt, tag counts, project cards — and exposes them at `/api/posts`. It is a projection, not a second database.

### Re-indexing Is a Feature

The `sync` command walks `content/` and imports every supported file. That sounds primitive. It is also the escape hatch that makes the system honest: if you edit a file by hand, run `sync`, and the site catches up.

The database never becomes a place where content goes to hide.

### What This Buys

- The archive loads without parsing every markdown file.
- Tags are a simple aggregation.
- Search has a stable, precomputed text field.
- RSS and sitemap generation share the same index as the UI.

Most importantly, the data model stays small enough to understand in one sitting. A blog is not an enterprise content platform. It is a notebook with a better table of contents.

---

> Keep the files legible. Let the database be a convenience, not a cage.
