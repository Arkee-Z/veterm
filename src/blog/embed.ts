/**
 * Embedded content for Deno Deploy (no filesystem).
 * In production, all .md files are compiled into this map.
 * Keep in sync with content/ files.
 */
export const EMBEDDED_FILES: Record<string, string> = {
  "about.md": `# Gene Max Zhang

> Full-Stack Engineer · Open Source · Terminal Enthusiast

---

<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg> Chengdu, China  
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;margin-right:6px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> gene.max.zheng@foxmail.com  
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;margin-right:6px"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg> github.com/Arkee  

### About Me

I build the web through terminals. My work spans full-stack engineering with a focus on Rust, TypeScript, and Go. This blog itself is a terminal-driven experiment — every page you see here was published, edited, and styled entirely through the command pane below.

I believe the terminal is the most honest interface between a developer and their machine. Everything else is decoration.

### Skills

- **Languages:** TypeScript, Go, C, Python
- **Frontend:** Fresh, PWA, Wails, WASM
- **Backend:** Deno, SQLite, Gin, FastAPI
- **Infra:** Docker, Linux, GitHub Actions

### Projects

- **Veterm Blog** — This very site. Terminal-native blog engine built with Deno + SQLite.
- **Open source** — Active contributor on GitHub. See \`goto github\` for links.

### Motto

> "Code is poetry written in logic."
`,
  "posts/hello-world.md": `# Hello, Terminal

> Press Ctrl+Shift+P to unlock the command pane.

---

Welcome to **Veterm** — a blog that treats the browser like a terminal emulator. This isn't your average static site. Everything you see here — every post, every project page, every theme toggle — happens through a command-line interface hidden behind a keyboard shortcut.

### How It Works

Think of Veta as a tiny operating system for your blog:

- **The View** — Clean, academic-style cards with monospace typography. No distractions.
- **The Editor** — Raw Markdown, Ctrl+S to save. What you type is what you get.
- **The Terminal** — \`ls\`, \`cat\`, \`edit\`, \`mount\`, \`goto\` — familiar shell commands that manipulate real files backed by SQLite.

### Your First Commands

Try these in the terminal (Ctrl+Shift+P):

\`\`\`bash
cat about.md          # View the about page
cat hello-world       # You're reading this now
ls posts/             # List all blog posts
goto home             # Always returns you to the homepage
\`\`\`

### Why Build This?

Because GUIs are overrated. A well-designed CLI is faster, keyboard-driven, and forces you to think about your content rather than how it looks. Every design decision in Veta — from the font stack to the double-rule blockquote — was made deliberately to serve the reading experience.

### What's Next

I'll be writing about:

1. **Deno runtime internals** — how this very server runs
2. **SQLite as a CMS** — database-first content management
3. **Terminal UX patterns** — keyboard shortcuts, autocomplete, command history
4. **Building project sandboxes** — how \`mount\` + \`goto\` create virtual sub-sites

### Join In

This blog is open source. Visit \`goto github\` to fork it, deploy your own instance, or contribute commands you'd like to see.

---

> *"The terminal is the most honest interface between a developer and their machine."*
`,
};

/**
 * Detect if running on Deno Deploy (no filesystem).
 */
export function isDenoDeploy(): boolean {
  return typeof Deno.stat !== "function";
}