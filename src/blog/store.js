/**
 * Content store — SQLite-backed with a filesystem mirror.
 *
 * SQLite is the fast read path. When a file on disk is newer than its database
 * row (for example after a manual edit), the disk copy wins and is re-indexed.
 */
import { dirname, join } from "node:path";
import { mkdir, readFile as readFileFs, readdir, rm, stat, writeFile as writeFileFs } from "node:fs/promises";
import * as db from "../db/database.js";
const CONTENT_ROOT = "./content";
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const SUPPORTED_EXTENSIONS = new Set(["md", "txt", "json", "html"]);
export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
    }
}
// ---------------------------------------------------------------- path safety
/** Normalize and validate a relative path inside content/. */
export function normalizePath(input, allowEmpty = false) {
    if (typeof input !== "string")
        throw new Error("Invalid path");
    let p = input.trim().replace(/\\/g, "/");
    p = p.replace(/^\.\/+/, "").replace(/\/+/g, "/").replace(/\/+$/, "");
    if (!p) {
        if (allowEmpty)
            return "";
        throw new Error("Path cannot be empty");
    }
    if (p.length > 240)
        throw new Error("Path is too long");
    if (p.startsWith("/") || p.includes("\x00") || p.includes("~") ||
        /^[a-zA-Z]:/.test(p)) {
        throw new Error("Access denied: invalid path");
    }
    if (p.split("/").some((segment) => segment === ".." || segment === "." || segment === "")) {
        throw new Error("Access denied: invalid path");
    }
    return p;
}
export function getExtension(path) {
    const name = path.split("/").pop() || "";
    const index = name.lastIndexOf(".");
    return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}
export function isSupportedFile(path) {
    return SUPPORTED_EXTENSIONS.has(getExtension(path));
}
export function inferPageType(path) {
    return getExtension(path) === "html" ? "html" : "md";
}
export function ensureMarkdownExtension(path) {
    return getExtension(path) ? path : `${path}.md`;
}
// ---------------------------------------------------------------- disk helpers
function diskPath(path) {
    return join(CONTENT_ROOT, path);
}
function isNotFound(err) {
    const code = err.code;
    return code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR";
}
function parseDbTime(value) {
    if (!value)
        return 0;
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const ms = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
    return Number.isNaN(ms) ? 0 : ms;
}
async function readDiskFile(path) {
    const fullPath = diskPath(path);
    try {
        const info = await stat(fullPath);
        if (!info.isFile())
            return null;
        const content = await readFileFs(fullPath, "utf8");
        return { content, mtimeMs: info.mtimeMs };
    }
    catch (err) {
        if (isNotFound(err))
            return null;
        throw err;
    }
}
async function writeDiskFile(path, content) {
    const fullPath = diskPath(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFileFs(fullPath, content, "utf8");
}
/** Walk content/ and collect files and directories. */
async function walkDisk() {
    const files = new Map();
    const dirs = new Set();
    async function walk(relativeDir) {
        const fullDir = relativeDir ? diskPath(relativeDir) : CONTENT_ROOT;
        let entries;
        try {
            entries = await readdir(fullDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith("."))
                continue;
            const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                dirs.add(relPath);
                await walk(relPath);
            }
            else if (entry.isFile() && isSupportedFile(entry.name)) {
                let mtimeMs = 0;
                try {
                    const info = await stat(diskPath(relPath));
                    mtimeMs = info.mtimeMs;
                }
                catch { /* ignored */ }
                files.set(relPath, { type: inferPageType(entry.name), mtimeMs });
            }
        }
    }
    await walk("");
    return { files, dirs };
}
// ---------------------------------------------------------------- reading
export async function readPage(filePath) {
    const path = normalizePath(filePath);
    if (!isSupportedFile(path)) {
        throw new Error("Access denied: unsupported file type");
    }
    const row = db.getPage(path);
    const disk = await readDiskFile(path);
    const rowTime = parseDbTime(row?.updated_at);
    // Disk wins when it was modified after the last index.
    if (disk && (!row || disk.mtimeMs > rowTime + 1000)) {
        const type = row?.type === "link" && extractLink(disk.content)
            ? "link"
            : inferPageType(path);
        if (db.isDbAvailable())
            db.upsertPage(path, disk.content, type);
        return {
            path,
            content: disk.content,
            type,
            updatedAt: new Date(disk.mtimeMs).toISOString(),
        };
    }
    if (row) {
        return {
            path,
            content: row.content,
            type: row.type,
            updatedAt: row.updated_at,
        };
    }
    if (disk) {
        const type = inferPageType(path);
        if (db.isDbAvailable())
            db.upsertPage(path, disk.content, type);
        return {
            path,
            content: disk.content,
            type,
            updatedAt: new Date(disk.mtimeMs).toISOString(),
        };
    }
    throw new NotFoundError(`No such file: ${path}`);
}
export async function readFile(filePath) {
    return (await readPage(filePath)).content;
}
export async function getPageType(filePath) {
    return (await readPage(filePath)).type;
}
/** Is the content a single external URL (used by link projects)? */
export function extractLink(content) {
    const trimmed = content.trim();
    if (!trimmed || /\s/.test(trimmed))
        return null;
    return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}
/** Link detection is limited to project pages and explicit link rows. */
export function pageLink(page) {
    if (page.type !== "link" && !page.path.startsWith("projects/"))
        return null;
    return extractLink(page.content);
}
// ---------------------------------------------------------------- listing
export async function listFiles(dirPath = "") {
    const dir = normalizePath(dirPath, true);
    const prefix = dir ? `${dir}/` : "";
    const entries = new Map();
    const add = (name, isDirectory, type, updatedAt) => {
        if (!name)
            return;
        const existing = entries.get(name);
        if (existing && existing.isDirectory)
            return;
        entries.set(name, {
            name,
            path: prefix + name,
            isDirectory,
            type: isDirectory ? undefined : type,
            updatedAt: isDirectory ? undefined : updatedAt,
        });
    };
    for (const meta of db.listAllPageMeta()) {
        if (!meta.path.startsWith(prefix))
            continue;
        const rest = meta.path.slice(prefix.length);
        if (!rest)
            continue;
        const slashIndex = rest.indexOf("/");
        if (slashIndex === -1)
            add(rest, false, meta.type, meta.updated_at);
        else
            add(rest.slice(0, slashIndex), true);
    }
    try {
        const diskEntries = await readdir(diskPath(dir), { withFileTypes: true });
        for (const entry of diskEntries) {
            if (entry.name.startsWith("."))
                continue;
            if (entry.isDirectory()) {
                add(entry.name, true);
            }
            else if (entry.isFile() && isSupportedFile(entry.name)) {
                let updatedAt = "";
                try {
                    const info = await stat(diskPath(`${prefix}${entry.name}`));
                    updatedAt = info.mtime.toISOString();
                }
                catch { /* ignored */ }
                add(entry.name, false, inferPageType(entry.name), updatedAt);
            }
        }
    }
    catch { /* directory may not exist */ }
    return [...entries.values()].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory)
            return -1;
        if (!a.isDirectory && b.isDirectory)
            return 1;
        return a.name.localeCompare(b.name);
    });
}
/** Flat list of every file and directory (used by the editor tree + API). */
export async function listAllEntries() {
    const entries = new Map();
    const addDir = (path) => {
        const segments = path.split("/");
        for (let i = 1; i <= segments.length; i++) {
            const partial = segments.slice(0, i).join("/");
            if (!entries.has(partial)) {
                entries.set(partial, {
                    name: segments[i - 1],
                    path: partial,
                    isDirectory: true,
                });
            }
        }
    };
    for (const meta of db.listAllPageMeta()) {
        const segments = meta.path.split("/");
        if (segments.length > 1)
            addDir(segments.slice(0, -1).join("/"));
        entries.set(meta.path, {
            name: segments[segments.length - 1],
            path: meta.path,
            isDirectory: false,
            type: meta.type,
            updatedAt: meta.updated_at,
        });
    }
    const disk = await walkDisk();
    for (const dir of disk.dirs)
        addDir(dir);
    for (const [path, meta] of disk.files) {
        entries.set(path, {
            name: path.split("/").pop() || path,
            path,
            isDirectory: false,
            type: meta.type,
            updatedAt: meta.mtimeMs ? new Date(meta.mtimeMs).toISOString() : "",
        });
    }
    return [...entries.values()].sort((a, b) => {
        const depthA = a.path.split("/").length;
        const depthB = b.path.split("/").length;
        if (depthA !== depthB)
            return depthA - depthB;
        return a.path.localeCompare(b.path);
    });
}
export async function listProjects() {
    const entries = await listAllEntries();
    const projects = new Set();
    for (const entry of entries) {
        if (!entry.isDirectory)
            continue;
        const parts = entry.path.split("/");
        if (parts.length === 2 && parts[0] === "projects")
            projects.add(parts[1]);
    }
    return [...projects].sort();
}
// ---------------------------------------------------------------- resolving
/**
 * Resolve a short user-supplied name to an actual page.
 * Examples: `hello-world` → `posts/hello-world.md`, `about` → `about.md`.
 */
export async function resolveFilePath(raw) {
    const input = normalizePath(raw);
    const candidates = [];
    if (getExtension(input)) {
        candidates.push(input);
    }
    else {
        candidates.push(`${input}.md`, input, `posts/${input}.md`, `posts/${input}`, `projects/${input}/index.md`, `projects/${input}/index.html`);
    }
    for (const candidate of candidates) {
        try {
            return await readPage(candidate);
        }
        catch (err) {
            if (!(err instanceof Error))
                throw err;
        }
    }
    throw new NotFoundError(`File not found: ${raw}`);
}
/** Validate a project name and return its index page (if any). */
export async function resolveProject(name) {
    const cleaned = name.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(cleaned)) {
        throw new NotFoundError(`Invalid project name: ${name}`);
    }
    for (const path of [
        `projects/${cleaned}/index.html`,
        `projects/${cleaned}/index.md`,
    ]) {
        try {
            return await readPage(path);
        }
        catch { /* try the next candidate */ }
    }
    throw new NotFoundError(`Project not found: ${cleaned}`);
}
// ---------------------------------------------------------------- writing
export async function writeFile(filePath, content, type) {
    const path = normalizePath(filePath);
    if (!isSupportedFile(path) && type !== "html") {
        throw new Error("Access denied: unsupported file type");
    }
    if (content.length > MAX_FILE_SIZE) {
        throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024}KB)`);
    }
    // Preserve link projects when the editor saves them.
    let pageType = type ?? inferPageType(path);
    if (!type) {
        const existing = db.getPage(path);
        if (existing?.type === "link" && extractLink(content))
            pageType = "link";
    }
    await writeDiskFile(path, content);
    if (db.isDbAvailable())
        db.upsertPage(path, content, pageType);
    return { path, content, type: pageType, updatedAt: new Date().toISOString() };
}
export async function createFile(filePath) {
    const path = normalizePath(filePath);
    if (!isSupportedFile(path)) {
        throw new Error("Access denied: unsupported file type");
    }
    if (db.getPage(path) || (await readDiskFile(path))) {
        throw new Error(`File already exists: ${path}`);
    }
    return await writeFile(path, "", inferPageType(path));
}
export async function createDirectory(dirPath) {
    const path = normalizePath(dirPath);
    const fullPath = diskPath(path);
    try {
        const info = await stat(fullPath);
        if (info.isFile())
            throw new Error(`A file already exists at: ${path}`);
    }
    catch (err) {
        if (!isNotFound(err))
            throw err;
    }
    await mkdir(fullPath, { recursive: true });
}
export async function deleteFile(filePath) {
    const path = normalizePath(filePath);
    if (!isSupportedFile(path)) {
        throw new Error("Access denied: unsupported file type");
    }
    if (db.isDbAvailable())
        db.deletePage(path);
    await rm(diskPath(path), { force: true });
}
export async function deleteDirectory(dirPath) {
    const path = normalizePath(dirPath);
    if (db.isDbAvailable())
        db.deletePagesByPrefix(`${path}/`);
    await rm(diskPath(path), { recursive: true, force: true });
}
export function getContentRoot() {
    return CONTENT_ROOT;
}
