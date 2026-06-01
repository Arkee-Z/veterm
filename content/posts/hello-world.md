# Hello, Terminal

> Press Ctrl+Shift+P to unlock the command pane.

---

Welcome to **Veta** — a blog that treats the browser like a terminal emulator. This isn't your average static site. Everything you see here — every post, every project page, every theme toggle — happens through a command-line interface hidden behind a keyboard shortcut.

### How It Works

Think of Veta as a tiny operating system for your blog:

- **The View** — Clean, academic-style cards with monospace typography. No distractions.
- **The Editor** — Raw Markdown, Ctrl+S to save. What you type is what you get.
- **The Terminal** — `ls`, `cat`, `edit`, `mount`, `goto` — familiar shell commands that manipulate real files backed by SQLite.

### Your First Commands

Try these in the terminal (Ctrl+Shift+P):

```bash
cat about.md          # View the about page
cat hello-world       # You're reading this now
ls posts/             # List all blog posts
goto home             # Always returns you to the homepage
```

### Why Build This?

Because GUIs are overrated. A well-designed CLI is faster, keyboard-driven, and forces you to think about your content rather than how it looks. Every design decision in Veta — from the font stack to the double-rule blockquote — was made deliberately to serve the reading experience.

### What's Next

I'll be writing about:

1. **Deno runtime internals** — how this very server runs
2. **SQLite as a CMS** — database-first content management
3. **Terminal UX patterns** — keyboard shortcuts, autocomplete, command history
4. **Building project sandboxes** — how `mount` + `goto` create virtual sub-sites

### Join In

This blog is open source. Visit `goto github` to fork it, deploy your own instance, or contribute commands you'd like to see.

---

> *"The terminal is the most honest interface between a developer and their machine."*