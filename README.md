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

This is a Node.js app, not a static site. The production shape is:

```text
Internet -> Caddy (80/443) -> Node 127.0.0.1:8000
```

You need a host with a persistent filesystem for `data/` and `content/`. A small VPS is enough.

### 1. Point DNS at the server

Create an `A` record (and `AAAA` if you use IPv6) for your domain, for example:

```text
blog.example.com -> your.server.ip
```

Wait for DNS to resolve before starting Caddy; otherwise certificate issuance will fail.

### 2. Install Node.js 24+

On Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

The result must be `v24` or newer. Avoid installing Node only under `/root/.nvm`: the systemd service runs as `www-data` and must be able to execute the same Node binary. For a system service, a system-wide Node install is simpler.

### 3. Clone the site and configure it

```bash
sudo mkdir -p /opt
sudo git clone https://github.com/Arkee-Z/veterm.git /opt/veterm

cd /opt/veterm
sudo cp .env.example .env
sudo nano .env
```

Set at least:

```env
VETERM_ADMIN_PASSWORD=your-long-password
HOST=127.0.0.1
PORT=8000
SITE_URL=https://blog.example.com
```

`SITE_URL` is used for RSS and sitemap links. Binding `127.0.0.1` means only Caddy can reach the app; port 8000 is not exposed publicly.

Create the writable paths and give the service user ownership:

```bash
sudo mkdir -p /opt/veterm/data /opt/veterm/content
sudo chown -R www-data:www-data /opt/veterm
```

The app writes SQLite to `data/` and edited posts to `content/`, so `www-data` must be able to write there. `.env` must be readable by `www-data`, but should not be world-readable:

```bash
sudo chmod 640 /opt/veterm/.env
```

### 4. Run it with systemd

Create `/etc/systemd/system/veterm.service`:

```ini
[Unit]
Description=Veterm blog
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/veterm
ExecStart=/usr/bin/node /opt/veterm/main.js
Environment=NODE_ENV=production
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
```

Check the Node path first:

```bash
command -v node
```

If it is not `/usr/bin/node`, replace `ExecStart` with the real path. The app loads `.env` automatically from `WorkingDirectory`, so no `EnvironmentFile` line is needed.

Start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now veterm
sudo systemctl status veterm --no-pager
```

Test locally:

```bash
curl -I http://127.0.0.1:8000
curl -s http://127.0.0.1:8000/api/posts | head
```

Logs:

```bash
sudo journalctl -u veterm -f
```

### 5. Put Caddy in front

If Nginx is running only its default site, stop it first so it does not occupy port 80:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

Only do this if Nginx is not serving another site. If it is, keep Nginx and use an Nginx reverse proxy instead (see below).

Edit `/etc/caddy/Caddyfile`:

```caddy
blog.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8000
}
```

Apply it:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
```

Caddy will obtain and renew HTTPS automatically. Check the listeners:

```bash
sudo ss -ltnp | grep -E ':(80|443)\s'
```

Both should show `caddy`.

Allow HTTP/HTTPS in the firewall, but not 8000:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 6. Verify

```bash
curl -I https://blog.example.com
curl -s https://blog.example.com/api/posts | head
```

Open `https://blog.example.com` in a browser. Log in through the terminal:

```text
login admin your-password
```

If Caddy returns **502**, Node is not running or is not listening on `127.0.0.1:8000`. If HTTPS certificate issuance fails, check DNS and that ports 80/443 are reachable.

### Updating

```bash
cd /opt/veterm
sudo git pull
sudo chown -R www-data:www-data /opt/veterm
sudo systemctl restart veterm
```

Back up the important writable state:

```bash
cd /opt/veterm
sudo tar czf /root/veterm-backup-$(date +%F).tar.gz content data .env
```

### Using Nginx instead of Caddy

If Nginx already serves other sites, keep it and proxy Veterm to `127.0.0.1:8000`. A minimal server block:

```nginx
server {
    listen 80;
    server_name blog.example.com;
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

Then run `sudo nginx -t`, reload Nginx, and issue a certificate with `sudo certbot --nginx -d blog.example.com`. Do not run Caddy and Nginx on the same ports.

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
