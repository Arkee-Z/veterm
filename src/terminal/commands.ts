/**
 * Command Registry — all commands are registered here with metadata.
 * Each command declares its required permission group — no external table needed.
 */
import { getSessionFromRequest, verifyUser, createSession } from "../server/auth.ts";
import * as store from "../blog/store.ts";
import { renderMarkdown } from "../blog/render.ts";
import { canListDirectory } from "./permissions.ts";
import { cin, cout, sync } from "../db/sync.ts";
import type { UserGroup } from "./permissions.ts";

export interface CommandResult {
  output: string;
  html?: string;
  filePath?: string;
  source?: string;
  clear?: boolean;
  close?: boolean;
  sessionCookie?: string;
  action?: string;
  link?: string;
}

export interface CommandDef {
  name: string;
  help: string;
  /** "all" → visitor+admin, "admin" → admin-only */
  group: "all" | "admin";
  handler: (args: string[], ctx: CommandContext) => Promise<CommandResult>;
}

export interface CommandContext {
  group: UserGroup;
  session: ReturnType<typeof getSessionFromRequest>;
  req: Request;
}

// ---- Registry ----
const registry = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef): void {
  registry.set(def.name, def);
}

export function findCommand(name: string): CommandDef | undefined {
  return registry.get(name);
}

export function getHelpText(): string {
  const lines: string[] = ["Available commands:\n"];
  const bySection: Record<string, string[]> = {
    BROWSING: [],
    EDITING: [],
    "FILE OPS (admin)": [],
    NAVIGATION: [],
    AUTH: [],
    SYSTEM: [],
  };
  for (const [, def] of registry) {
    const line = `    ${def.name.padEnd(10)} ${def.help}`;
    if (["ls", "cat"].includes(def.name)) bySection["BROWSING"].push(line);
    else if (["edit", "touch"].includes(def.name)) bySection["EDITING"].push(line);
    else if (["mkdir", "mount", "rm", "rmdir", "cin", "cout", "sync"].includes(def.name)) bySection["FILE OPS (admin)"].push(line);
    else if (["goto"].includes(def.name)) bySection["NAVIGATION"].push(line);
    else if (["login", "logout", "whoami"].includes(def.name)) bySection["AUTH"].push(line);
    else bySection["SYSTEM"].push(line);
  }
  for (const [section, cmds] of Object.entries(bySection)) {
    if (cmds.length === 0) continue;
    if (section === "SYSTEM") {
      cmds.push("    theme      Toggle dark/light theme");
    }
    lines.push(`  ${section}:`);
    lines.push(...cmds);
    lines.push("");
  }
  lines.push("Default credentials:");
  lines.push("  admin / (set VETA_ADMIN_PASSWORD env var)");
  lines.push("  guest / guest");
  return lines.join("\n").trim();
}

// ---- Utility ----
async function resolveFilePath(raw: string): Promise<string> {
  // Block traversal/null-byte attacks
  if (raw.includes("..") || raw.includes("~") || raw.includes("\x00") || raw.startsWith("/")) {
    throw new Error("Access denied: invalid path");
  }

  const candidates: string[] = [];
  if (raw.includes(".")) {
    candidates.push(raw);
  } else {
    candidates.push(raw + ".md", raw, "posts/" + raw + ".md", "posts/" + raw);
  }

  // Try DB first (faster, works for imported files not on disk)
  for (const path of candidates) {
    try {
      await store.readFile(path);
      return path;
    } catch { /* next */ }
  }

  // Fallback to disk stat for files not yet in DB
  for (const path of candidates) {
    try { await Deno.stat(`./content/${path}`); return path; } catch { /* next */ }
  }

  throw new Error(`File not found: ${raw}`);
}

// ---- Command Handlers ----

async function handleLs(args: string[], ctx: CommandContext): Promise<CommandResult> {
  const dirPath = args[0] || "";
  if (!canListDirectory(dirPath, ctx.group)) {
    return { output: "Permission denied." };
  }
  try {
    const files = await store.listFiles(dirPath);
    if (files.length === 0) {
      return { output: "(empty directory)", action: "list", html: "<p><em>(empty directory)</em></p>" };
    }
    const dirSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    const fileSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

    const output = files.map((f) => f.isDirectory ? `  ${f.name}/` : `  ${f.name}`).join("\n");
    const html = files.map((f) => {
      const icon = f.isDirectory ? dirSvg : fileSvg;
      const dp = f.isDirectory ? f.name + "/" : f.name;
      // HTML-escape file names to prevent XSS
      const safe = dp.replace(/\x26/g, "\x26amp;").replace(/</g, "\x26lt;").replace(/>/g, "\x26gt;").replace(/"/g, "\x26quot;");
      return `<div><span style="margin-right:8px">${icon}</span> <span>${safe}</span></div>`;
    }).join("");
    return { output, html, action: "list" };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleCat(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: cat <filename>" };
  const filePath = await resolveFilePath(args[0]);
  try {
    const content = await store.readFile(filePath);
    return { output: content, html: renderMarkdown(content), source: content, filePath, action: "render" };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleEdit(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: edit <filename>" };
  const filePath = args[0];
  try {
    let content = "";
    try { content = await store.readFile(filePath); } catch { /* new file */ }
    return { output: `Editing: ${filePath}\n(Ctrl+S to save)`, source: content, filePath, action: "edit" };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleTouch(args: string[]): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: touch <filename>" };
  try {
    await store.createFile(args[0]);
    return { output: `Created: ${args[0]}` };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleMkdir(args: string[]): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: mkdir <dirname>" };
  try {
    await store.createDirectory(args[0]);
    return { output: `Created directory: ${args[0]}` };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleRm(args: string[]): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: rm <filename>" };
  try {
    await store.deleteFile(args[0]);
    return { output: `Deleted: ${args[0]}` };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleRmdir(args: string[]): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: rmdir <dirname>" };
  try {
    await store.deleteDirectory(args[0]);
    return { output: `Deleted directory: ${args[0]}` };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

async function handleLogin(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  if (args.length < 2) return { output: "Usage: login <username> <password>" };
  const user = await verifyUser(args[0], args[1]);
  if (!user) return { output: "Invalid username or password." };
  const id = createSession(user);
  return { output: `Logged in as ${user.username} (${user.group}).`, sessionCookie: `session=${id}; Path=/; HttpOnly; SameSite=Strict` };
}

function handleLogout(): CommandResult {
  return { output: "Logged out.", sessionCookie: "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" };
}

async function handleWhoami(_args: string[], ctx: CommandContext): Promise<CommandResult> {
  const s = ctx.session;
  return { output: s ? `Logged in as: ${s.username} (${s.group})` : "Logged in as: visitor (not authenticated)" };
}

async function handleHelp(): Promise<CommandResult> {
  return { output: getHelpText(), action: "message" };
}

// ---- mount command (admin) ----
// mount <name> project   → create HTML project sandbox
// mount <name> link <url> → create link reference
async function handleMount(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  if (args.length < 1) return { output: "Usage:\n  mount <name> project\n  mount <name> link <url>" };
  const name = args[0].toLowerCase().replace(/[^a-z0-9\-]/g, "-");
  if (!name) return { output: "Invalid project name." };

  const subCmd = args[1] || "project";

  if (subCmd === "link") {
    const url = args[2];
    if (!url) return { output: "Usage: mount <name> link <url>" };
    if (!/^https?:\/\//.test(url)) return { output: "Invalid URL: must start with http:// or https://" };
    const filePath = `projects/${name}/index.md`;
    try {
      await store.createDirectory(`projects/${name}`);
      await store.writeFile(filePath, url, "link");
      return { output: `Mounted link: ${name} → ${url}` };
    } catch (err) {
      return { output: `Error: ${(err as Error).message}` };
    }
  }

  // Default: project mode
  const dirPath = `projects/${name}`;
  const indexPath = `projects/${name}/index.html`;

  try {
    // Check if already exists
    try {
      await store.readFile(indexPath);
      return { output: `Project '${name}' already exists. Use 'goto ${name}' to view it.` };
    } catch { /* doesn't exist */ }

    const tpl = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${name}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#333;background:#fafafa;}h1{font-size:1.8rem;}p{line-height:1.7;}</style></head><body><h1>${name}</h1><p>Your custom HTML project page.</p></body></html>`;

    await store.createDirectory(dirPath);
    await store.writeFile(indexPath, tpl, "html");
    return { output: `Mounted project: ${name}\nDirectory: content/${dirPath}\nIndex: content/${indexPath}` };
  } catch (err) {
    return { output: `Error: ${(err as Error).message}` };
  }
}

// ---- goto command (all) ----
// goto <name>    → navigate to project/link
// goto home      → return to blog main
async function handleGoto(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: goto <name>  |  goto home" };
  const name = args[0].toLowerCase();

  // goto home → return to main blog
  if (name === "home") {
    return { output: "home", action: "goto_home" };
  }

  // Try project/index.html first
  const htmlPath = `projects/${name}/index.html`;
  const mdPath = `projects/${name}/index.md`;

  try {
    // Check html type first
    const row = await store.readFile(htmlPath).then((c) => ({ content: c, type: "html" })).catch(async () => {
      const c = await store.readFile(mdPath);
      return { content: c, type: await store.getPageType(mdPath) };
    });

    if (row.type === "link") {
      return { output: `Redirecting to: ${row.content}`, action: "goto_link", link: row.content };
    }

    if (row.type === "html") {
      return { output: row.content, html: row.content, filePath: htmlPath, action: "render_project" };
    }

    return { output: row.content, html: renderMarkdown(row.content), source: row.content, filePath: mdPath, action: "render" };
  } catch {
    return { output: `Project not found: ${name}. Use 'mount ${name}' to create it.` };
  }
}

// ---- cin/cout/sync (admin) ----
async function handleCin(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  if (args.length === 0) return { output: "Usage: cin <file_path>" };
  try { return { output: await cin(args[0]) }; }
  catch (err) { return { output: `Error: ${(err as Error).message}` }; }
}
async function handleCout(args: string[], _ctx: CommandContext): Promise<CommandResult> {
  try { return { output: await cout(args[0]) }; }
  catch (err) { return { output: `Error: ${(err as Error).message}` }; }
}
async function handleSync(_args: string[], _ctx: CommandContext): Promise<CommandResult> {
  try { return { output: await sync() }; }
  catch (err) { return { output: `Error: ${(err as Error).message}` }; }
}

// ---- Register all commands ----
registerCommand({ name: "ls", group: "all", help: "List directory contents", handler: handleLs });
registerCommand({ name: "cat", group: "all", help: "View file content (rendered)", handler: handleCat });
registerCommand({ name: "edit", group: "admin", help: "Open file in web editor", handler: handleEdit });
registerCommand({ name: "touch", group: "admin", help: "Create a new empty file", handler: (a) => handleTouch(a) });
registerCommand({ name: "mkdir", group: "admin", help: "Create a directory", handler: (a) => handleMkdir(a) });
registerCommand({ name: "mount", group: "admin", help: "Mount project or link", handler: handleMount });
registerCommand({ name: "goto", group: "all", help: "Navigate to project or home", handler: handleGoto });
registerCommand({ name: "cin", group: "admin", help: "Import .md file to DB", handler: handleCin });
registerCommand({ name: "cout", group: "admin", help: "Export DB to .md files", handler: handleCout });
registerCommand({ name: "sync", group: "admin", help: "Sync content/ to DB", handler: handleSync });
registerCommand({ name: "rm", group: "admin", help: "Delete a file", handler: (a) => handleRm(a) });
registerCommand({ name: "rmdir", group: "admin", help: "Delete a directory", handler: (a) => handleRmdir(a) });
registerCommand({ name: "login", group: "all", help: "Log in", handler: handleLogin });
registerCommand({ name: "logout", group: "all", help: "Log out", handler: async () => handleLogout() });
registerCommand({ name: "whoami", group: "all", help: "Show current user", handler: handleWhoami });
registerCommand({ name: "help", group: "all", help: "Show this help", handler: async () => handleHelp() });
registerCommand({ name: "clear", group: "all", help: "Clear terminal", handler: async () => ({ output: "", clear: true }) });
registerCommand({ name: "exit", group: "all", help: "Close terminal", handler: async () => ({ output: "Bye!", close: true, action: "message" }) });
