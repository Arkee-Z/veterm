# Hello, Terminal

> Press Ctrl+Shift+P to open the command pane.

---

Welcome to **Veterm** — a blog that treats the browser like a terminal emulator. This isn't your average static site. Everything you see here — every post, every project page, every theme toggle — happens through a floating command-line overlay triggered by a keyboard shortcut.

### How It Works (v2.0)

Three independent panels, zero clutter:

- **The View** — Academic-style cards with monospace typography. Always visible. Hash-routed so browser back/forward works.
- **The Editor** — Ctrl+Shift+E. Admin-only fullscreen workspace with a file tree sidebar. Ctrl+S writes to SQLite and refreshes the encrypted local cache.
- **The Terminal** — Ctrl+Shift+P. Floating overlay. `cat`, `ls`, `goto`, `mount`, `theme` — familiar shell commands that read directly from the database.

### Your First Commands

Try these in the terminal:

```bash
cat about.md          # See who built this
cat hello-world       # You're reading this now
ls posts/             # List all blog posts
goto home             # Return to the homepage
theme                 # Switch to light mode
```

### Why Build This?

Because GUIs are overrated. A well-designed CLI is faster, keyboard-driven, and forces you to think about your content rather than how it looks. Veterm eliminates the distinction between authoring and browsing — they happen in the same interface, through the same muscle memory.

### What's Next

- **Deno runtime internals** — how this very server runs
- **SQLite as a CMS** — database-first content management
- **Terminal UX patterns** — autocomplete, history, signal handling
- **Project sandboxes** — how `mount` + `goto` create sub-sites
- **Encrypted caching** — AES-GCM localStorage under the hood

### Open Source

This blog is open source. `goto github` to fork it, deploy your own instance, or contribute the commands you want to see.

---

> *"The terminal is the most honest interface between a developer and their machine."*