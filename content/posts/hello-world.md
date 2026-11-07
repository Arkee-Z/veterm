---
title: Hello, Terminal
date: 2026-06-04
description: A blog that treats the browser like a terminal — and why the command line is still the most honest interface for publishing.
tags: [terminal, design, node]
featured: true
---

> Press Ctrl+Shift+P to open the command palette.

---

Welcome to **Veterm** — a blog that treats the browser like a terminal emulator. This isn't your average static site. Everything you see here — every post, every project page, every theme toggle — happens through a command-line interface layered over a deliberately quiet reading page.

### How It Works

Three independent surfaces, zero clutter:

- **The View** — An editorial reading layout with breadcrumbs, archive, tags, projects, and keyboard-first search.
- **The Editor** — `Ctrl+Shift+E`. Admin-only fullscreen workspace with a nested file tree. `Ctrl+S` writes to SQLite and mirrors the file on disk.
- **The Terminal** — `Ctrl+Shift+P`. A docked command palette with history, completion, and project navigation.

### Your First Commands

Try these in the terminal:

```bash
cat about.md          # See who built this
cat hello-world       # You're reading this now
archive               # Open the post archive
tags                  # Browse writing by tag
search sqlite         # Search the full index
goto github           # Open a mounted project
theme                 # Switch to light mode
```

### Why Build This?

Because GUIs are often overrated. A well-designed CLI is fast, keyboard-driven, and forces you to think about your content rather than how it looks. But readers still deserve typography, hierarchy, and a little breathing room.

Veterm eliminates the distinction between authoring and browsing — they happen in the same interface, through the same muscle memory.

### What's Next

- **Node.js runtime internals** — how this server actually runs
- **SQLite as a CMS** — database-first content management
- **Terminal UX patterns** — autocomplete, history, and graceful failure
- **Project sandboxes** — how `mount` + `goto` create sub-sites
- **Encrypted caching** — AES-GCM localStorage under the hood

### Open Source

This blog is open source. `goto github` to fork it, deploy your own instance, or contribute the commands you want to see.

---

> *"The terminal is the most honest interface between a developer and their machine."*
