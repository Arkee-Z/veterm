/**
 * Import/Export/Sync commands.
 * - cin: copy a local .md file into content/ and database
 * - cout: export database contents to local .md files
 * - sync: sync content/ directory changes into database
 */
import * as db from "./database.ts";
import { isDenoDeploy } from "../blog/embed.ts";

const CONTENT_ROOT = "./content";
const ERR_DEPLOY = "Deno Deploy does not support file read/write operations. Use a local instance for cin/cout/sync.";

/**
 * cin <path> — import a local .md file into content/ and DB.
 */
export async function cin(filePath: string): Promise<string> {
  if (isDenoDeploy()) throw new Error(ERR_DEPLOY);
  if (filePath.includes("..") || filePath.includes("~") || filePath.includes("\x00")) {
    throw new Error("Access denied: invalid path");
  }
  if (!filePath.endsWith(".md")) {
    throw new Error("Only .md files can be imported.");
  }

  // Read source file
  let content: string;
  try {
    content = await Deno.readTextFile(filePath);
  } catch {
    throw new Error(`Cannot read file: ${filePath}`);
  }

  // Determine destination name
  const name = filePath.replace(/\\/g, "/").split("/").pop()!;
  const destRel = name; // put in content/ root

  // Write to content/
  try {
    await Deno.mkdir(CONTENT_ROOT, { recursive: true });
    await Deno.writeTextFile(`${CONTENT_ROOT}/${destRel}`, content);
  } catch (err) {
    throw new Error(`Failed to write to content/: ${(err as Error).message}`);
  }

  // Upsert to DB
  db.upsertPage(destRel, content, "md");

  return `Imported: ${destRel} (${content.length} bytes)`;
}

/**
 * cout [dir] — export all database contents to local .md files.
 */
export async function cout(outputDir: string = "./export"): Promise<string> {
  if (isDenoDeploy()) throw new Error(ERR_DEPLOY);
  if (outputDir.includes("..") || outputDir.includes("~") || outputDir.includes("\x00")) {
    throw new Error("Access denied: invalid output directory");
  }
  const pages = db.getAllPages();
  if (pages.length === 0) return "Database is empty. Nothing to export.";

  await Deno.mkdir(outputDir, { recursive: true });
  let count = 0;

  for (const page of pages) {
    if (page.type !== "md") continue;
    const outPath = `${outputDir}/${page.path}`;
    // Ensure parent dir exists
    const parent = outPath.substring(0, outPath.lastIndexOf("/"));
    if (parent !== outputDir) {
      await Deno.mkdir(parent, { recursive: true }).catch(() => {});
    }
    await Deno.writeTextFile(outPath, page.content);
    count++;
  }

  return `Exported ${count} files to ${outputDir}/`;
}

/**
 * sync — sync content/ directory changes into database.
 */
export async function sync(): Promise<string> {
  if (isDenoDeploy()) throw new Error(ERR_DEPLOY);
  const count = await db.fullSyncFromDisk();
  return `Synced ${count} pages from content/ to database.`;
}