# Veterm — Terminal Blog Engine

A modern, database-backed notebook rebuilt on **Node.js**: an editorial reading layout with an archive, tag index, project sandboxes, RSS, and a keyboard-first search palette — all backed by a terminal that can still edit every file.

## Features

| 🖥️ Terminal | 📝 Admin Editor | 🔐 Caching & Security |
|---|---|---|
| 22 registered commands — `cat` `archive` `search` `goto` `mount` | Ctrl+Shift+E — nested file tree + editor | AES-GCM encrypted localStorage cache |
| Terminal completion + history + resize | Ctrl+S / Save button · dirty indicator | PBKDF2 100k SHA-256 hashing |
| `mount` / `goto` — HTML projects, markdown projects & links | Front-matter metadata, TOC, reading time, related posts | HTTP-only sessions + login/API rate limiting |

The viewer is always visible. The terminal docks above the status bar without taking over the page; the editor opens as a focused full-screen workspace.

## Layout & Routes

```
┌──────────────┬─────────────────────────────────────────────┐
│ Veterm       │ ~ / archive / building-veterm-on-node  ⌘K  │ topbar
│ Home         ├─────────────────────────────────────────────┤
│ Archive      │                                             │
│ Tags         │   article / archive / home / projects       │  viewer
│ Projects     │   (sidebar + reading column + TOC)          │
│ About        │                                             │
│              ├─────────────────────────────────────────────┤
│ tags · now   │ $ terminal — command palette               │  docked shell
│ actions      ├─────────────────────────────────────────────┤
│              │ Ready · path · user                        │  status bar
└──────────────┴─────────────────────────────────────────────┘
```

| Route | Result |
|---|---|
| `#/` | Home — hero, featured note, latest writing |
| `#/archive` | Archive grouped by year |
| `#/archive/<tag>` | Archive filtered by tag |
| `#/tags` | Tag index |
| `#/projects` | Project cards |
| `#/projects/github` | HTML project / link project / project markdown |
| `#/posts/<slug>` | Article with metadata, TOC, related notes |
| `#/about` | About page |
| `#/post/<slug>` | Legacy short alias |
| `#project:github` | Legacy project alias |

Also generated: `/rss.xml`, `/sitemap.xml`, `/robots.txt`.

Browser back/forward works. Unknown routes render an in-app error card with **Retry**, **Back home**, and **Open terminal** actions.

### Keyboard

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+K` or `/` | Open the search palette |
| `Ctrl/Cmd+Shift+P` | Toggle terminal |
| `Ctrl/Cmd+Shift+E` | Toggle admin editor |
| `Tab` | Complete commands/paths (press again to cycle) |
| `↑` / `↓` | Command history |
| `Ctrl+L` | Clear terminal |
| `Ctrl+C` | Clear current input |
| `Ctrl+S` | Save in the editor |
| `Esc` | Clear input → close terminal / close editor |

## Architecture

```
main.js → src/bootstrap.js (node:http)
├── server/
│   ├── auth.js       (PBKDF2 + sessions + cookies)
│   ├── router.js     (static files, ETag, error pages)
│   ├── api.js        (cmd/save/render/project/tree/session)
│   └── middleware.js (rate limiting)
├── terminal/
│   ├── commands.js    (registered command handlers)
│   ├── executor.js    (thin scheduler)
│   └── permissions.js (access control)
├── blog/
│   ├── store.js    (SQLite + disk content layer, path safety)
│   ├── meta.js     (front matter + text metadata)
│   ├── content.js  (posts/tags/projects index)
│   ├── feed.js     (RSS + sitemap)
│   └── render.js   (Markdown → sanitized HTML)
└── db/
    ├── database.js (node:sqlite)
    └── sync.js     (import/export/sync)
```

- **Zero runtime dependencies** — Node built-ins only: `node:http`, `node:sqlite`, `node:fs/promises`, `node:crypto`.
- The desktop sidebar is fixed; on mobile it becomes a drawer. Tags and projects live in the sidebar, while the home aside holds Now / Marginalia / Colophon.
- Front matter gives each post a title, date, description, tags, and optional `featured` flag. The public index at `/api/posts` powers the home page, archive, tag index, search, RSS, and sitemap.
- SQLite is the fast read path. When a file on disk is newer than its database row, the disk copy is read and re-indexed.
- The HTTP layer uses Node's built-in Web `Request`/`Response` globals, so it can be tested with standard fetch semantics.
- Paths are normalized and validated for every read and write.

## Requirements

- **Node.js 24 or newer** (recommended: Node 26). `node:sqlite` is used; Node 22 users should upgrade.
- No `npm install` required for runtime dependencies. `npm install` is only needed if you add tooling later.

## Quick Start

```bash
git clone https://github.com/Arkee-Z/veterm.git
cd veterm

cp .env.example .env
# edit .env and set VETERM_ADMIN_PASSWORD

npm run dev      # watch mode
# or
npm start        # production
```

Open **http://localhost:8000**.

`main.js` loads `.env` automatically when it exists, so `node main.js` works the same way as the npm scripts.

```bash
npm test        # renderer + path-safety tests
npm run check   # node --check every JavaScript file
```

**Ctrl+Shift+P** → terminal · **Ctrl+Shift+E** → editor (admin) · Login:

```
login admin yourpassword
```

> The legacy environment variable `VETA_ADMIN_PASSWORD` is still read. If no admin password is configured, admin login is disabled and the site remains readable as `guest / guest`.

## Command Reference

| Command | Usage | Access |
|---------|-------|--------|
| `ls [path]` | List directory contents | all |
| `cat <file>` | View rendered markdown / project | all |
| `archive` | Open the post archive | all |
| `tags` | Open the tag index | all |
| `search <term>` | Search the content index | all |
| `edit <file>` | Open in web editor | admin |
| `touch <file>` | Create empty file | admin |
| `mkdir <dir>` | Create directory | admin |
| `mount <name>` | Create project sandbox | admin |
| `mount <name> link <url>` | Add external link | admin |
| `goto <name>` | Navigate to project | all |
| `goto home` | Return to about page | all |
| `cin <path>` | Import .md to site | admin |
| `cout [dir]` | Export pages to .md | admin |
| `sync` | Sync content/ to DB | admin |
| `rm <file>` | Delete file | admin |
| `rmdir <dir>` | Delete directory | admin |
| `login <user> <pass>` | Authenticate | all |
| `logout` | Clear session | all |
| `whoami` | Show current user | all |
| `theme [dark\|light]` | Toggle theme | all |
| `help` | Show help | all |
| `clear` | Clear terminal | all |
| `exit` | Close terminal | all |

## Data

- `content/` — source-of-truth markdown/HTML files (tracked). Posts use front matter (`title`, `date`, `description`, `tags`, `featured`); projects can add `meta.json` for card copy.
- `data/veta.db` — generated SQLite database (ignored by git, recreated on first start).
- `.env` — local secrets (ignored by git).

The app seeds the database from `content/` on first run. The editor writes both SQLite and the matching file under `content/`; the terminal `sync` command re-indexes manual file changes.

## Deploy

### VPS / systemd

Create `/etc/systemd/system/veterm.service`:

```ini
[Unit]
Description=Veterm blog
After=network.target

[Service]
WorkingDirectory=/opt/veterm
ExecStart=/usr/local/bin/node /opt/veterm/main.js
EnvironmentFile=/opt/veterm/.env
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now veterm
```

Set `PORT`, `HOST`, and optionally `SITE_URL` (used in RSS/sitemap links) in `.env`. For HTTPS, put Nginx/Caddy in front of the Node process.

## Tech Stack

- **Runtime**: Node.js 24+ (`node:http`)
- **Content**: Markdown + front matter, SQLite index, RSS/sitemap
- **Database**: SQLite via Node's built-in `node:sqlite`
- **Frontend**: Vanilla JS + CSS (zero framework)
- **Cache**: Web Crypto AES-GCM encrypted localStorage
- **Icons**: Inline SVG
- **Fonts**: Sarasa Mono SC, LXGW WenKai Mono

## License

MIT — feel free to fork and deploy your own terminal blog.
