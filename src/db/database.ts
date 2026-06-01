/**
 * SQLite-based persistence layer.
 * Stores all content (pages, posts, projects) in a single table.
 * Falls back to embedded content on Deno Deploy.
 */
import { Database } from "@db/sqlite";
import { EMBEDDED_FILES, isDenoDeploy } from "../blog/embed.ts";

export interface PageRow {
  id: number;
  path: string;
  content: string;
  type: "md" | "html" | "link";
  created_at: string;
  updated_at: string;
}

let db: Database | null = null;

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function isDbAvailable(): boolean {
  return db !== null;
}

export async function initDb(): Promise<void> {
  if (isDenoDeploy()) {
    console.log("Deno Deploy detected — using embedded content, no SQLite.");
    return;
  }

  await Deno.mkdir("./data", { recursive: true }).catch(() => {});

  db = new Database("./data/veta.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'md' CHECK(type IN ('md','html','link')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed from embedded files if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM pages").get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO pages (path, content, type) VALUES (?, ?, ?)"
    );
    for (const [path, content] of Object.entries(EMBEDDED_FILES)) {
      const type: "md" | "html" = path.endsWith(".html") ? "html" : "md";
      insert.run(path, content, type);
    }
    // Also seed from local content/ if it exists
    await syncFromDisk();
    console.log("Database seeded with initial content.");
  }

  console.log("SQLite database initialized.");
}

// ---- CRUD ----

export function listPages(prefix: string = ""): Pick<PageRow, "path" | "type">[] {
  if (!db) {
    // Deploy fallback
    return Object.keys(EMBEDDED_FILES)
      .filter((k) => k.startsWith(prefix))
      .map((k) => ({ path: k, type: "md" as const }));
  }
  const stmt = db.prepare(
    "SELECT path, type FROM pages WHERE path LIKE ? ORDER BY type DESC, path ASC"
  );
  return stmt.all(`${prefix}%`) as Pick<PageRow, "path" | "type">[];
}

export function getPage(path: string): PageRow | null {
  if (!db) {
    const content = EMBEDDED_FILES[path];
    if (content === undefined) return null;
    return { id: 0, path, content, type: "md", created_at: "", updated_at: "" };
  }
  const stmt = db.prepare("SELECT * FROM pages WHERE path = ?");
  return (stmt.get(path) as PageRow) || null;
}

export function upsertPage(path: string, content: string, type: "md" | "html" | "link" = "md"): void {
  if (!db) return;
  const stmt = db.prepare(`
    INSERT INTO pages (path, content, type, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET content = excluded.content, type = excluded.type, updated_at = datetime('now')
  `);
  stmt.run(path, content, type);
}

export function deletePage(path: string): void {
  if (!db) return;
  const stmt = db.prepare("DELETE FROM pages WHERE path = ?");
  stmt.run(path);
}

export function deletePagesByPrefix(prefix: string): void {
  if (!db) return;
  const stmt = db.prepare("DELETE FROM pages WHERE path LIKE ?");
  stmt.run(`${prefix}%`);
}

export function getAllPages(): PageRow[] {
  if (!db) {
    return Object.entries(EMBEDDED_FILES).map(([path, content]) => ({
      id: 0, path, content, type: "md" as const, created_at: "", updated_at: ""
    }));
  }
  const stmt = db.prepare("SELECT * FROM pages ORDER BY path");
  return stmt.all() as PageRow[];
}

// ---- Sync with disk ----

async function syncFromDisk(): Promise<void> {
  if (!db) return;
  const contentRoot = "./content";
  try {
    await Deno.stat(contentRoot);
  } catch {
    return; // no content directory
  }
  await walkAndImport(contentRoot, "");
}

async function walkAndImport(baseDir: string, relativeDir: string): Promise<void> {
  const fullDir = relativeDir ? `${baseDir}/${relativeDir}` : baseDir;
  try {
    for await (const entry of Deno.readDir(fullDir)) {
      const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        await walkAndImport(baseDir, relPath);
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".html")) {
        const content = await Deno.readTextFile(`${baseDir}/${relPath}`);
        const type: "md" | "html" = entry.name.endsWith(".html") ? "html" : "md";
        upsertPage(relPath, content, type);
      }
    }
  } catch { /* permission or missing dir */ }
}

export async function fullSyncFromDisk(): Promise<number> {
  if (!db) return 0;
  await syncFromDisk();
  const stmt = db.prepare("SELECT COUNT(*) as c FROM pages");
  const row = stmt.get() as { c: number };
  return row.c;
}