# Veterm — Terminal Blog Engine

A modern, database-backed blog engine driven entirely through a **floating terminal overlay** powered by **Deno**. Browse posts, edit content, mount project sandboxes, and manage an encrypted local cache — all from the command-line.

## Features

| 🖥️ Terminal | 📝 Admin Editor | 🔐 Caching & Security |
|---|---|---|
| 19 registered commands — `cat` `ls` `goto` `mount` `theme` | Ctrl+Shift+E — file tree + textarea | AES-GCM encrypted localStorage cache |
| Tab autocomplete (command + file-aware) | Ctrl+S → SQLite + cache refresh | PBKDF2 100k SHA-256 hashing |
| `mount`/`goto` — HTML projects & external links | Hash routing (#post/hello-world) | HTTP-only sessions + rate-limiting |

### Architecture

```
main.ts → bootstrap.ts
├── auth.ts       (PBKDF2 + session)
├── router.ts     (HTTP routing)
│   └── api.ts    (POST /api/cmd, /api/save, GET /api/render, /api/session)
├── terminal/
│   ├── commands.ts    (registered command handlers)
│   ├── executor.ts    (thin scheduler)
│   └── permissions.ts (access control)
├── blog/
│   ├── store.ts   (DB-first content layer)
│   ├── render.ts  (Markdown → HTML)
│   └── embed.ts   (Deno Deploy fallback)
└── db/
    ├── database.ts (SQLite wrapper)
    └── sync.ts     (import/export/sync)
```

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Arkee-Z/veterm.git && cd veterm

# 2. Set admin password
echo 'VETERM_ADMIN_PASSWORD=yourpassword' > .env

# 3. Run
deno task dev        # development (hot-reload)
deno task start      # production

# 4. Open
open http://localhost:8000
```

**Ctrl+Shift+P** → floating terminal · **Ctrl+Shift+E** → admin editor · Login:

```
login admin yourpassword
```

## Command Reference

| Command | Usage | Access |
|---------|-------|--------|
| `ls [path]` | List directory contents | all |
| `cat <file>` | View rendered markdown | all |
| `edit <file>` | Open in web editor | admin |
| `touch <file>` | Create empty file | admin |
| `mkdir <dir>` | Create directory | admin |
| `mount <name>` | Create project sandbox | admin |
| `mount <name> link <url>` | Add external link | admin |
| `goto <name>` | Navigate to project | all |
| `goto home` | Return to about page | all |
| `cin <path>` | Import .md to DB | admin |
| `cout [dir]` | Export DB to .md | admin |
| `sync` | Sync content/ to DB | admin |
| `rm <file>` | Delete file | admin |
| `rmdir <dir>` | Delete directory | admin |
| `login <user> <pass>` | Authenticate | all |
| `logout` | Clear session | all |
| `whoami` | Show current user | all |
| `theme` | Toggle dark/light | all |
| `help` | Show this help | all |
| `clear` | Clear terminal | all |
| `exit` | Close terminal | all |

## Deploy

```bash
# Deno Deploy (one-click)
Push to GitHub → dash.deno.com → New Project → env `VETERM_ADMIN_PASSWORD`

# VPS (systemd)
cp veterm.service /etc/systemd/system/ && systemctl enable --now veterm
```

## Tech Stack

- **Runtime**: Deno
- **Database**: SQLite (`@db/sqlite`)
- **Frontend**: Vanilla JS + CSS (zero framework)
- **Cache**: Web Crypto AES-GCM encrypted localStorage
- **Icons**: Inline SVG
- **Fonts**: Sarasa Mono SC, LXGW WenKai Mono

## License

MIT — feel free to fork and deploy your own terminal blog.