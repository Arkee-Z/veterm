/**
 * Content store — database-first with filesystem sync.
 * On Deno Deploy, falls back to embedded content.
 */
import { EMBEDDED_FILES, isDenoDeploy } from "./embed.ts";
import * as db from "../db/database.ts";

const CONTENT_ROOT = "./content";
const isDeploy = isDenoDeploy();
const ERR_DEPLOY_WRITE = "File writing is not available on Deno Deploy. Deploy locally for full editing.";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export async function listFiles(dirPath: string = ""): Promise<FileEntry[]> {
  // Prevent directory traversal
  if (dirPath.includes("..") || dirPath.includes("~") || dirPath.includes("\x00")) {
    throw new Error("Access denied: invalid path");
  }

  const sanitized = dirPath.replace(/\/+$/, "");
  const prefix = sanitized ? `${sanitized}/` : "";
  const pages = db.listPages(prefix);

  const entries: FileEntry[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const rest = page.path.slice(prefix.length);
    if (!rest) continue;
    const slashIdx = rest.indexOf("/");
    const name = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const isDir = slashIdx !== -1 && slashIdx < rest.length - 1;
    entries.push({ name, path: prefix + name, isDirectory: isDir });
  }

  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export async function readFile(filePath: string): Promise<string> {
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  const row = db.getPage(filePath);
  if (row) return row.content;

  // Fallback to embedded
  const emb = EMBEDDED_FILES[filePath];
  if (emb !== undefined) return emb;

  throw new Error(`No such file: ${filePath}`);
}

export async function getPageType(filePath: string): Promise<string> {
  const row = db.getPage(filePath);
  return row?.type || "md";
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB

async function ensureParentDir(fullPath: string): Promise<void> {
  if (isDeploy) throw new Error(ERR_DEPLOY_WRITE);
  const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (!parentDir || parentDir === CONTENT_ROOT) return;
  try { await Deno.mkdir(parentDir, { recursive: true }); } catch { /* exists */ }
}

export async function writeFile(filePath: string, content: string, type: "md" | "html" | "link" = "md"): Promise<void> {
  if (isDeploy) throw new Error(ERR_DEPLOY_WRITE);
  if (!isAllowedPath(filePath) && type !== "html") {
    throw new Error("Access denied: unsupported file type");
  }

  if (content.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024}KB)`);
  }

  // Write to disk
  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  await ensureParentDir(fullPath);
  await Deno.writeTextFile(fullPath, content);

  // Write to DB
  db.upsertPage(filePath, content, type);
}

export async function createFile(filePath: string): Promise<void> {
  if (isDeploy) throw new Error(ERR_DEPLOY_WRITE);
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  // Check if exists in DB
  if (db.getPage(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }

  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  await ensureParentDir(fullPath);
  await Deno.writeTextFile(fullPath, "");
  db.upsertPage(filePath, "", "md");
}

export async function createDirectory(dirPath: string): Promise<void> {
  if (isDeploy) throw new Error(ERR_DEPLOY_WRITE);
  const fullPath = `${CONTENT_ROOT}/${dirPath}`;
  try {
    await Deno.mkdir(fullPath, { recursive: true });
  } catch {
    throw new Error(`Cannot create directory: ${dirPath}`);
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  if (isDeploy) throw new Error(ERR_DEPLOY_WRITE);
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  db.deletePage(filePath);

  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  try {
    await Deno.remove(fullPath);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
}

export async function deleteDirectory(dirPath: string): Promise<void> {
  if (isDeploy) throw new Error(ERR_DEPLOY_WRITE);
  db.deletePagesByPrefix(`${dirPath}/`);

  const fullPath = `${CONTENT_ROOT}/${dirPath}`;
  try {
    await Deno.remove(fullPath, { recursive: true });
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
}

function isAllowedPath(filePath: string): boolean {
  if (filePath.includes("..") || filePath.startsWith("/") || filePath.includes("\x00") || filePath.includes("~")) {
    return false;
  }
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "txt" || ext === "json" || ext === "html";
}

export function getContentRoot(): string {
  return CONTENT_ROOT;
}