/**
 * SQLite persistence for pages (posts, projects, about).
 * Uses Node's built-in `node:sqlite` module — no native npm dependency.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
const CONTENT_ROOT = "./content";
const DB_PATH = "./data/veta.db";
let db = null;
export function getDb() {
    if (!db)
        throw new Error("Database not initialized. Call initDb() first.");
    return db;
}
export function isDbAvailable() {
    return db !== null;
}
export async function initDb() {
    if (db)
        return;
    await mkdir("./data", { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'md' CHECK(type IN ('md','html','link')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
    const count = db.prepare("SELECT COUNT(*) AS c FROM pages").get();
    if (count.c === 0) {
        const imported = await syncFromDisk();
        console.log(`Database seeded with ${imported} content file(s).`);
    }
    console.log("SQLite database initialized.");
}
export function closeDb() {
    if (!db)
        return;
    db.close();
    db = null;
}
// ---- CRUD ----
export function listPages(prefix = "") {
    if (!db)
        return [];
    const stmt = db.prepare("SELECT path, type, updated_at FROM pages ORDER BY path ASC");
    return stmt.all().filter((row) => row.path.startsWith(prefix));
}
export function listAllPageMeta() {
    if (!db)
        return [];
    const stmt = db.prepare("SELECT path, type, updated_at FROM pages ORDER BY path ASC");
    return stmt.all();
}
export function countPages() {
    if (!db)
        return 0;
    const row = db.prepare("SELECT COUNT(*) AS c FROM pages").get();
    return row.c;
}
export function getPage(path) {
    if (!db)
        return null;
    const stmt = db.prepare("SELECT * FROM pages WHERE path = ?");
    return stmt.get(path) ?? null;
}
export function upsertPage(path, content, type = "md") {
    if (!db)
        return;
    const stmt = db.prepare(`
    INSERT INTO pages (path, content, type, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET content = excluded.content, type = excluded.type, updated_at = datetime('now')
  `);
    stmt.run(path, content, type);
}
export function deletePage(path) {
    if (!db)
        return;
    db.prepare("DELETE FROM pages WHERE path = ?").run(path);
}
export function deletePagesByPrefix(prefix) {
    if (!db)
        return;
    // Avoid LIKE: directory names may legitimately contain `_` or `%`.
    db.prepare("DELETE FROM pages WHERE substr(path, 1, ?) = ?").run(prefix.length, prefix);
}
export function getAllPages() {
    if (!db)
        return [];
    return db.prepare("SELECT * FROM pages ORDER BY path").all();
}
// ---- Sync with disk ----
async function syncFromDisk() {
    if (!db)
        return 0;
    try {
        const info = await stat(CONTENT_ROOT);
        if (!info.isDirectory())
            return 0;
    }
    catch (err) {
        if (err.code === "ENOENT")
            return 0;
        throw err;
    }
    let imported = 0;
    const walk = async (relativeDir) => {
        const fullDir = relativeDir
            ? `${CONTENT_ROOT}/${relativeDir}`
            : CONTENT_ROOT;
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
            const relPath = relativeDir
                ? `${relativeDir}/${entry.name}`
                : entry.name;
            if (entry.isDirectory()) {
                await walk(relPath);
            }
            else if (entry.isFile() && /\.(md|txt|json|html)$/i.test(entry.name)) {
                const content = await readFile(`${CONTENT_ROOT}/${relPath}`, "utf8");
                const type = entry.name.toLowerCase().endsWith(".html")
                    ? "html"
                    : "md";
                upsertPage(relPath, content, type);
                imported++;
            }
        }
    };
    await walk("");
    return imported;
}
export async function fullSyncFromDisk() {
    if (!db)
        return 0;
    await syncFromDisk();
    return countPages();
}
