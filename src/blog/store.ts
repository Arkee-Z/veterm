const CONTENT_ROOT = "./content";

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

  const fullPath = dirPath ? `${CONTENT_ROOT}/${dirPath}` : CONTENT_ROOT;

  try {
    await Deno.stat(fullPath);
  } catch {
    throw new Error(`No such directory: ${dirPath || "/"}`);
  }

  const entries: FileEntry[] = [];
  for await (const entry of Deno.readDir(fullPath)) {
    entries.push({
      name: entry.name,
      path: dirPath ? `${dirPath}/${entry.name}` : entry.name,
      isDirectory: entry.isDirectory,
    });
  }

  // Sort: directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export async function readFile(filePath: string): Promise<string> {
  // Restrict access to only .md, .txt, .json files within content/
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  try {
    return await Deno.readTextFile(fullPath);
  } catch {
    throw new Error(`No such file: ${filePath}`);
  }
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB

async function ensureParentDir(fullPath: string): Promise<void> {
  const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (!parentDir || parentDir === CONTENT_ROOT) return;
  try { await Deno.mkdir(parentDir, { recursive: true }); } catch { /* exists */ }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  if (content.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024}KB)`);
  }

  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  await ensureParentDir(fullPath);
  await Deno.writeTextFile(fullPath, content);
}

export async function createFile(filePath: string): Promise<void> {
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  await ensureParentDir(fullPath);

  // Check if file already exists
  try {
    await Deno.stat(fullPath);
    throw new Error(`File already exists: ${filePath}`);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      await Deno.writeTextFile(fullPath, "");
    } else {
      throw err;
    }
  }
}

export async function createDirectory(dirPath: string): Promise<void> {
  const fullPath = `${CONTENT_ROOT}/${dirPath}`;
  try {
    await Deno.mkdir(fullPath, { recursive: true });
  } catch {
    throw new Error(`Cannot create directory: ${dirPath}`);
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  if (!isAllowedPath(filePath)) {
    throw new Error("Access denied: unsupported file type");
  }

  const fullPath = `${CONTENT_ROOT}/${filePath}`;
  try {
    const stat = await Deno.stat(fullPath);
    if (stat.isDirectory) {
      throw new Error(`Is a directory, use rmdir: ${filePath}`);
    }
    await Deno.remove(fullPath);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new Error(`No such file: ${filePath}`);
    }
    throw err;
  }
}

export async function deleteDirectory(dirPath: string): Promise<void> {
  const fullPath = `${CONTENT_ROOT}/${dirPath}`;
  try {
    await Deno.remove(fullPath, { recursive: true });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new Error(`No such directory: ${dirPath}`);
    }
    throw err;
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    [String.fromCharCode(38)]: String.fromCharCode(38) + "amp;",
    [String.fromCharCode(60)]: String.fromCharCode(38) + "lt;",
    [String.fromCharCode(62)]: String.fromCharCode(38) + "gt;",
    [String.fromCharCode(34)]: String.fromCharCode(38) + "quot;",
  };
  return text.replace(/[&<>"]/g, (ch) => map[ch] || ch);
}

function isAllowedPath(filePath: string): boolean {
  // Prevent directory traversal
  if (filePath.includes("..") || filePath.startsWith("/") || filePath.includes("\x00") || filePath.includes("~")) {
    return false;
  }
  // Only allow markdown and text files
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "txt" || ext === "json";
}

export function getContentRoot(): string {
  return CONTENT_ROOT;
}