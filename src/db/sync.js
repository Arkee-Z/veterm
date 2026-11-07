/**
 * Import/Export/Sync commands.
 * - cin: copy a local .md file into content/ and the database
 * - cout: export database pages to local .md files
 * - sync: re-index content/ into the database
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as db from "./database.js";
import * as store from "../blog/store.js";
/**
 * cin <path> — import a local .md file into content/ and the DB.
 */
export async function cin(filePath) {
    if (!filePath || filePath.includes("\x00")) {
        throw new Error("Access denied: invalid path");
    }
    if (!filePath.toLowerCase().endsWith(".md")) {
        throw new Error("Only .md files can be imported.");
    }
    let content;
    try {
        content = await readFile(filePath, "utf8");
    }
    catch {
        throw new Error(`Cannot read file: ${filePath}`);
    }
    const name = filePath.replace(/\\/g, "/").split("/").pop() || "";
    const destination = store.normalizePath(name);
    if (!store.isSupportedFile(destination)) {
        throw new Error("Access denied: unsupported destination file type");
    }
    const page = await store.writeFile(destination, content);
    return `Imported: ${page.path} (${content.length} bytes)`;
}
/**
 * cout [dir] — export all markdown pages to local .md files.
 */
export async function cout(outputDir = "./export") {
    if (!outputDir || outputDir.includes("..") || outputDir.includes("~") ||
        outputDir.includes("\x00")) {
        throw new Error("Access denied: invalid output directory");
    }
    const pages = db.getAllPages();
    if (pages.length === 0)
        return "Database is empty. Nothing to export.";
    await mkdir(outputDir, { recursive: true });
    let count = 0;
    for (const page of pages) {
        if (page.type !== "md")
            continue;
        let safePath;
        try {
            safePath = store.normalizePath(page.path);
        }
        catch {
            continue;
        }
        const outPath = `${outputDir}/${safePath}`;
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, page.content, "utf8");
        count++;
    }
    return `Exported ${count} files to ${outputDir}/`;
}
/**
 * sync — re-index the content/ directory into the database.
 */
export async function sync() {
    const count = await db.fullSyncFromDisk();
    return `Synced ${count} pages from content/ to the database.`;
}
