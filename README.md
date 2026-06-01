# Veta Blog — Terminal-Controlled Blog Engine

A modern, minimal, single-binary blog engine powered by **Deno** and an embedded **terminal** interface. Everything is accessed through a command-line — reading posts, editing files, navigating projects, all from a beautiful academic-style viewer.

## Features

| 🖥️ Terminal Commands | 📝 Built-in Editor | 🎨 Dual Theme |
|---|---|---|
| `ls` `cat` `edit` `touch` `mkdir` `mount` `goto` `rm` `rmdir` | Full Markdown editor with Ctrl+S save | Dark (midnight study) / Light (daytime paper) |
| `cin` `cout` `sync` — import/export/sync with SQLite | Read-only source preview mode | Monospace CJK font stack (Sarasa Mono) |
| `login` `whoami` `help` `theme` `clear` `exit` | Syntax-aware tab completion for files, dirs, commands | Keyboard-only navigation |

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
git clone https://github.com/Arkee-Z/veta.git && cd veta

# 2. Set admin password
echo 'VETA_ADMIN_PASSWORD=yourpassword' > .env

# 3. Run
deno task dev        # development (hot-reload)
deno task start      # production

# 4. Open
open http://localhost:8000
```

Press **Ctrl+Shift+P** to open the terminal. Login as `admin` for write access:

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
push to GitHub → dash.deno.com → New Project → set VETA_ADMIN_PASSWORD env

# VPS (systemd)
sudo cp veta.service /etc/systemd/system/ && sudo systemctl enable --now veta
```

## Tech Stack

- **Runtime**: Deno
- **Database**: SQLite (`@db/sqlite`)
- **Frontend**: Vanilla JS + CSS (zero framework)
- **Icons**: Inline SVG (Lucide-style)
- **Fonts**: Sarasa Mono SC, LXGW WenKai Mono

## License

MIT — feel free to fork and deploy your own terminal blog.