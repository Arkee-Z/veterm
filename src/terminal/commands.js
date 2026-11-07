/**
 * Command Registry — every command is registered here with metadata.
 * Each command declares its required permission group — no external table needed.
 */
import { buildClearSessionCookie, buildSessionCookie, createSession, destroySession, getSessionIdFromRequest, isAdminConfigured, verifyUser, } from "../server/auth.js";
import { clearLoginFailures, getClientIp, isLoginBlocked, recordLoginFailure, } from "../server/middleware.js";
import * as store from "../blog/store.js";
import { renderMarkdown } from "../blog/render.js";
import { canListDirectory } from "./permissions.js";
import { cin, cout, sync } from "../db/sync.js";
import { getContentIndex } from "../blog/content.js";
// ---- Registry ----
const registry = new Map();
export function registerCommand(def) {
    registry.set(def.name, def);
}
export function findCommand(name) {
    return registry.get(name);
}
export function getCommandNames() {
    return [...registry.keys()].sort();
}
export function getHelpText() {
    const rows = {
        BROWSING: [],
        EDITING: [],
        "FILE OPS (admin)": [],
        NAVIGATION: [],
        AUTH: [],
        SYSTEM: [],
    };
    for (const [, def] of registry) {
        const line = `    ${def.name.padEnd(10)} ${def.help}`;
        if (["ls", "cat", "archive", "tags", "search"].includes(def.name))
            rows.BROWSING.push(line);
        else if (["edit", "touch"].includes(def.name))
            rows.EDITING.push(line);
        else if (["mkdir", "mount", "rm", "rmdir", "cin", "cout", "sync"].includes(def.name)) {
            rows["FILE OPS (admin)"].push(line);
        }
        else if (["goto"].includes(def.name))
            rows.NAVIGATION.push(line);
        else if (["login", "logout", "whoami"].includes(def.name)) {
            rows.AUTH.push(line);
        }
        else
            rows.SYSTEM.push(line);
    }
    const lines = ["Available commands:", ""];
    for (const [section, commands] of Object.entries(rows)) {
        if (commands.length === 0)
            continue;
        lines.push(`  ${section}:`);
        lines.push(...commands);
        lines.push("");
    }
    lines.push("  Keyboard:");
    lines.push("    Tab        Complete commands and paths (press again to cycle)");
    lines.push("    ↑ / ↓      Browse command history");
    lines.push("    Ctrl+L     Clear the screen · Ctrl+C clears the input line");
    lines.push("    Esc        Clear input, then close the terminal");
    lines.push("");
    lines.push("  Default credentials:");
    lines.push("    guest / guest  (read-only)");
    if (isAdminConfigured()) {
        lines.push("    admin / <VETERM_ADMIN_PASSWORD>");
    }
    else {
        lines.push("    admin disabled — set VETERM_ADMIN_PASSWORD in .env");
    }
    return lines.join("\n").trim();
}
// ---- Utility ----
function errorResult(message) {
    return { output: `Error: ${message}`, error: true };
}
async function resolveOrError(raw) {
    try {
        return { ok: true, page: await store.resolveFilePath(raw) };
    }
    catch (err) {
        return { ok: false, result: errorResult(err.message) };
    }
}
// ---- Command Handlers ----
async function handleLs(args, ctx) {
    const dirPath = args[0] || "";
    if (!canListDirectory(dirPath, ctx.group)) {
        return { output: "Permission denied.", error: true };
    }
    try {
        const files = await store.listFiles(dirPath);
        if (files.length === 0) {
            return { output: "(empty directory)", action: "list" };
        }
        const output = files
            .map((file) => `  ${file.name}${file.isDirectory ? "/" : ""}`)
            .join("\n");
        return { output, action: "list" };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleCat(args) {
    if (args.length === 0)
        return errorResult("Usage: cat <filename>");
    const resolved = await resolveOrError(args[0]);
    if (!resolved.ok)
        return resolved.result;
    const page = resolved.page;
    const link = store.pageLink(page);
    if (link) {
        return {
            output: "",
            filePath: page.path,
            action: "render",
            pageType: "link",
            link,
        };
    }
    if (page.type === "html") {
        return {
            output: "",
            html: page.content,
            filePath: page.path,
            action: "render_project",
            pageType: "html",
        };
    }
    return {
        output: "",
        html: renderMarkdown(page.content),
        filePath: page.path,
        action: "render",
        pageType: "md",
    };
}
async function handleEdit(args, _ctx) {
    if (args.length === 0)
        return errorResult("Usage: edit <filename>");
    let filePath;
    let source = "";
    let pageType = "md";
    let isNew = false;
    try {
        try {
            const existing = await store.resolveFilePath(args[0]);
            filePath = existing.path;
            source = existing.content;
            pageType = existing.type;
        }
        catch {
            filePath = store.ensureMarkdownExtension(store.normalizePath(args[0]));
            isNew = true;
        }
        if (!store.isSupportedFile(filePath)) {
            throw new Error("Only .md, .txt, .json and .html files can be edited");
        }
    }
    catch (err) {
        return errorResult(err.message);
    }
    return {
        output: isNew
            ? `New file: ${filePath}\n(Ctrl+S to create and save · Esc to close)`
            : `Editing: ${filePath}\n(Ctrl+S to save · Esc to close)`,
        source,
        filePath,
        action: "edit",
        pageType,
        newFile: isNew,
    };
}
async function handleTouch(args) {
    if (args.length === 0)
        return errorResult("Usage: touch <filename>");
    try {
        const filePath = store.ensureMarkdownExtension(store.normalizePath(args[0]));
        const page = await store.createFile(filePath);
        return { output: `Created: ${page.path}` };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleMkdir(args) {
    if (args.length === 0)
        return errorResult("Usage: mkdir <dirname>");
    try {
        const dirPath = store.normalizePath(args[0]);
        await store.createDirectory(dirPath);
        return { output: `Created directory: ${dirPath}/` };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleRm(args) {
    if (args.length === 0)
        return errorResult("Usage: rm <filename>");
    try {
        const page = await store.resolveFilePath(args[0]);
        await store.deleteFile(page.path);
        return { output: `Deleted: ${page.path}` };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleRmdir(args) {
    if (args.length === 0)
        return errorResult("Usage: rmdir <dirname>");
    try {
        const dirPath = store.normalizePath(args[0]);
        await store.deleteDirectory(dirPath);
        return { output: `Deleted directory: ${dirPath}/` };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleLogin(args, ctx) {
    if (args.length < 2)
        return errorResult("Usage: login <username> <password>");
    const ip = getClientIp(ctx.req);
    if (isLoginBlocked(ip)) {
        return errorResult("Too many failed attempts. Try again in a few minutes.");
    }
    if (args[0] === "admin" && !isAdminConfigured()) {
        return errorResult("Admin login is disabled. Set VETERM_ADMIN_PASSWORD in .env and restart.");
    }
    const user = await verifyUser(args[0], args[1]);
    if (!user) {
        recordLoginFailure(ip);
        return errorResult("Invalid username or password.");
    }
    clearLoginFailures(ip);
    const id = createSession(user);
    return {
        output: `Logged in as ${user.username} (${user.group}).`,
        sessionCookie: buildSessionCookie(id, ctx.req),
    };
}
function handleLogout(ctx) {
    const sessionId = getSessionIdFromRequest(ctx.req);
    if (sessionId)
        destroySession(sessionId);
    return {
        output: "Logged out.",
        sessionCookie: buildClearSessionCookie(ctx.req),
    };
}
function handleWhoami(_args, ctx) {
    const session = ctx.session;
    return {
        output: session
            ? `Logged in as: ${session.username} (${session.group})`
            : "Logged in as: visitor (not authenticated)",
    };
}
async function handleArchive() {
    return { output: "Opened the archive.", action: "archive" };
}
async function handleTags() {
    return { output: "Opened the tag index.", action: "tags" };
}
async function handleSearch(args) {
    const query = args.join(" ").trim();
    if (!query) {
        return errorResult("Usage: search <term>");
    }
    const index = await getContentIndex();
    const needle = query.toLowerCase();
    const matches = index.posts.filter((post) => `${post.title} ${post.tags.join(" ")} ${post.searchText}`.toLowerCase().includes(needle)).slice(0, 10);
    if (matches.length === 0) {
        return { output: `No posts match "${query}".`, error: true };
    }
    const lines = matches.map((post, i) => `  ${String(i + 1).padStart(2, "0")}  ${post.date || "----------"}  ${post.title}\n      ${post.path}${post.tags.length ? `  · ${post.tags.join(", ")}` : ""}`);
    return {
        output: `${matches.length} match${matches.length === 1 ? "" : "es"} for "${query}":\n\n${lines.join("\n")}`,
        action: "search",
        query,
    };
}
function handleHelp() {
    return { output: getHelpText(), action: "message" };
}
function handleTheme() {
    // The client intercepts `theme`; this keeps the command discoverable.
    return {
        output: "Theme is toggled locally in the browser.",
        action: "theme",
    };
}
// ---- mount command (admin) ----
// mount <name> project   → create HTML project sandbox
// mount <name> link <url> → create link reference
async function handleMount(args, _ctx) {
    if (args.length < 1) {
        return errorResult("Usage:\n  mount <name> project\n  mount <name> link <url>");
    }
    const name = args[0].toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!name)
        return errorResult("Invalid project name.");
    const subCmd = (args[1] || "project").toLowerCase();
    if (subCmd === "link") {
        const url = args[2];
        if (!url)
            return errorResult("Usage: mount <name> link <url>");
        if (!/^https?:\/\/\S+$/.test(url)) {
            return errorResult("Invalid URL: must start with http:// or https://");
        }
        const filePath = `projects/${name}/index.md`;
        try {
            await store.createDirectory(`projects/${name}`);
            await store.writeFile(filePath, url, "link");
            return { output: `Mounted link: ${name} → ${url}` };
        }
        catch (err) {
            return errorResult(err.message);
        }
    }
    if (subCmd !== "project") {
        return errorResult("Unknown mount type. Use 'project' or 'link'.");
    }
    const dirPath = `projects/${name}`;
    const indexPath = `projects/${name}/index.html`;
    try {
        try {
            await store.readPage(indexPath);
            return {
                output: `Project '${name}' already exists. Use 'goto ${name}' to view it.`,
            };
        }
        catch { /* doesn't exist yet */ }
        const tpl = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${name}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; max-width: 720px; margin: 64px auto; padding: 0 24px; color: #2a2724; background: #faf8f4; line-height: 1.7; }
  h1 { font-size: 1.6rem; letter-spacing: -0.01em; }
  h1::before { content: "$ "; color: #c0392b; }
  p { color: #555; }
  @media (prefers-color-scheme: dark) { body { color: #d6cfc3; background: #1c1a18; } p { color: #a0988a; } }
</style>
</head>
<body>
<h1>${name}</h1>
<p>Your custom HTML project page. Edit <code>content/${indexPath}</code> to replace this template.</p>
</body>
</html>`;
        await store.createDirectory(dirPath);
        await store.writeFile(indexPath, tpl, "html");
        return {
            output: `Mounted project: ${name}\nDirectory: content/${dirPath}/\nIndex: content/${indexPath}`,
        };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
// ---- goto command (all) ----
async function handleGoto(args) {
    const projects = await store.listProjects().catch(() => []);
    const listing = projects.length
        ? `\n\nMounted projects:\n${projects.map((p) => `  ${p}`).join("\n")}`
        : "\n\nNo projects mounted. Try: mount demo project";
    if (args.length === 0) {
        return {
            output: `Usage: goto <name>  |  goto home${listing}`,
        };
    }
    const name = args[0].toLowerCase();
    if (name === "home") {
        return { output: "Home", action: "goto_home" };
    }
    try {
        const page = await store.resolveProject(name);
        const link = store.extractLink(page.content);
        if (page.type === "link" || link) {
            return {
                output: `Link project: ${name} → ${page.content.trim()}`,
                action: "goto_link",
                link: link || page.content.trim(),
                filePath: page.path,
                projectName: name,
            };
        }
        if (page.type === "html") {
            return {
                output: "",
                html: page.content,
                filePath: page.path,
                action: "render_project",
                pageType: "html",
                projectName: name,
            };
        }
        return {
            output: "",
            html: renderMarkdown(page.content),
            filePath: page.path,
            action: "render",
            pageType: "md",
            projectName: name,
        };
    }
    catch (err) {
        return {
            output: `Error: ${err.message}${listing}`,
            error: true,
        };
    }
}
// ---- cin/cout/sync (admin) ----
async function handleCin(args) {
    if (args.length === 0)
        return errorResult("Usage: cin <file_path>");
    try {
        return { output: await cin(args[0]) };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleCout(args) {
    try {
        return { output: await cout(args[0]) };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
async function handleSync() {
    try {
        return { output: await sync() };
    }
    catch (err) {
        return errorResult(err.message);
    }
}
// ---- Register all commands ----
registerCommand({
    name: "ls",
    group: "all",
    help: "List directory contents",
    handler: handleLs,
});
registerCommand({
    name: "archive",
    group: "all",
    help: "Open the post archive",
    handler: handleArchive,
});
registerCommand({
    name: "tags",
    group: "all",
    help: "Browse posts by tag",
    handler: handleTags,
});
registerCommand({
    name: "search",
    group: "all",
    help: "Search posts (search <term>)",
    handler: handleSearch,
});
registerCommand({
    name: "cat",
    group: "all",
    help: "View a file (rendered)",
    handler: handleCat,
});
registerCommand({
    name: "edit",
    group: "admin",
    help: "Open a file in the web editor",
    handler: handleEdit,
});
registerCommand({
    name: "touch",
    group: "admin",
    help: "Create a new empty file",
    handler: (a) => handleTouch(a),
});
registerCommand({
    name: "mkdir",
    group: "admin",
    help: "Create a directory",
    handler: (a) => handleMkdir(a),
});
registerCommand({
    name: "mount",
    group: "admin",
    help: "Mount a project or external link",
    handler: handleMount,
});
registerCommand({
    name: "goto",
    group: "all",
    help: "Open a project or return home",
    handler: handleGoto,
});
registerCommand({
    name: "cin",
    group: "admin",
    help: "Import a .md file into the site",
    handler: handleCin,
});
registerCommand({
    name: "cout",
    group: "admin",
    help: "Export database pages to .md files",
    handler: handleCout,
});
registerCommand({
    name: "sync",
    group: "admin",
    help: "Sync content/ into the database",
    handler: handleSync,
});
registerCommand({
    name: "rm",
    group: "admin",
    help: "Delete a file",
    handler: (a) => handleRm(a),
});
registerCommand({
    name: "rmdir",
    group: "admin",
    help: "Delete a directory",
    handler: (a) => handleRmdir(a),
});
registerCommand({
    name: "login",
    group: "all",
    help: "Log in (login <user> <pass>)",
    handler: handleLogin,
});
registerCommand({
    name: "logout",
    group: "all",
    help: "Log out",
    handler: (_a, ctx) => handleLogout(ctx),
});
registerCommand({
    name: "whoami",
    group: "all",
    help: "Show the current user",
    handler: handleWhoami,
});
registerCommand({
    name: "help",
    group: "all",
    help: "Show this help",
    handler: handleHelp,
});
registerCommand({
    name: "theme",
    group: "all",
    help: "Toggle dark / light theme",
    handler: handleTheme,
});
registerCommand({
    name: "clear",
    group: "all",
    help: "Clear the terminal",
    handler: () => ({ output: "", clear: true }),
});
registerCommand({
    name: "exit",
    group: "all",
    help: "Close the terminal",
    handler: () => ({ output: "Bye!", close: true, action: "message" }),
});
