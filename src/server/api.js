import { executeCommand } from "../terminal/executor.js";
import * as store from "../blog/store.js";
import { renderMarkdown } from "../blog/render.js";
import { getContentIndex } from "../blog/content.js";
import {
    normalizeDate,
    normalizeTags,
    parseFrontMatter,
    plainText,
    readingTime,
} from "../blog/meta.js";
import { getSessionFromRequest, isAdminConfigured } from "./auth.js";
import { checkRateLimit, getClientIp } from "./middleware.js";
const JSON_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
};
function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...JSON_HEADERS, ...extraHeaders },
    });
}
export async function handleApi(req, pathname) {
    const ip = getClientIp(req);
    const limited = () => json({ error: "Too many requests. Please slow down." }, 429);
    switch (true) {
        // POST /api/cmd
        case pathname === "/api/cmd" && req.method === "POST":
            if (!checkRateLimit(ip))
                return limited();
            return await handleCmd(req);
        // POST /api/save
        case pathname === "/api/save" && req.method === "POST":
            if (!checkRateLimit(ip))
                return limited();
            return await handleSave(req);
        // GET /api/render?file=...
        case pathname === "/api/render" && req.method === "GET":
            if (!checkRateLimit(ip))
                return limited();
            return await handleRender(req);
        // GET /api/project?name=...
        case pathname === "/api/project" && req.method === "GET":
            if (!checkRateLimit(ip))
                return limited();
            return await handleProject(req);
        // GET /api/tree
        case pathname === "/api/tree" && req.method === "GET":
            if (!checkRateLimit(ip))
                return limited();
            return await handleTree();
        // GET /api/posts — public index for home/archive/search
        case (pathname === "/api/posts" || pathname === "/api/index") && req.method === "GET":
            if (!checkRateLimit(ip))
                return limited();
            return await handlePosts();
        // GET /api/session
        case pathname === "/api/session" && req.method === "GET":
            return handleSession(req);
        default:
            return json({ error: "Not found" }, 404);
    }
}
function pageTitle(page) {
    if (page.type === "html") {
        const match = page.content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return match ? match[1].trim() : page.path;
    }
    let inCode = false;
    for (const line of page.content.split("\n")) {
        if (line.trim().startsWith("```")) {
            inCode = !inCode;
            continue;
        }
        if (inCode)
            continue;
        const heading = line.match(/^\s*#\s+(.+?)(?:\s+#+)?\s*$/);
        if (heading)
            return heading[1].replace(/[*_`]/g, "").trim();
    }
    return page.path;
}
function serializePage(page, includeContent = true) {
    const link = store.pageLink(page);
    const type = link ? "link" : page.type;
    const { data, body } = page.type === "md"
        ? parseFrontMatter(page.content)
        : { data: {}, body: page.content };
    const tags = normalizeTags(data.tags);
    const text = page.type === "md" ? plainText(body) : plainText(page.content);
    const title = String(data.title || pageTitle(page));
    const excerpt = String(data.description || text.slice(0, 220)).trim();
    const date = normalizeDate(data.date) || normalizeDate(page.updatedAt);
    const slug = String(data.slug || page.path.split("/").pop()?.replace(/\.md$/i, "") || "");
    return {
        path: page.path,
        title,
        type,
        updatedAt: page.updatedAt,
        content: includeContent ? page.content : undefined,
        html: type === "html"
            ? page.content
            : type === "md"
                ? renderMarkdown(page.content)
                : null,
        link,
        date,
        slug,
        tags,
        excerpt,
        readingTime: page.type === "md" ? readingTime(body) : 1,
        featured: data.featured === true || data.featured === "true",
        meta: {
            title,
            description: excerpt,
            date,
            tags,
            featured: data.featured === true || data.featured === "true",
            layout: String(data.layout || "article"),
            location: String(data.location || ""),
            email: String(data.email || ""),
            github: String(data.github || ""),
        },
    };
}
async function handleCmd(req) {
    try {
        const body = await req.json();
        const { command } = body;
        if (!command || typeof command !== "string") {
            return json({ error: "Missing command" }, 400);
        }
        if (command.length > 2000) {
            return json({ output: "Error: Command is too long.", error: true }, 400);
        }
        const result = await executeCommand(command, req);
        const headers = {};
        if (result.sessionCookie)
            headers["Set-Cookie"] = result.sessionCookie;
        return json(result, 200, headers);
    }
    catch (err) {
        return json({ output: `Error: ${err.message}`, error: true }, 500);
    }
}
async function handleSave(req) {
    const session = getSessionFromRequest(req);
    if (!session || session.group !== "admin") {
        return json({ error: "Permission denied" }, session ? 403 : 401);
    }
    try {
        const body = await req.json();
        const { filePath, content } = body;
        if (!filePath || typeof filePath !== "string" || typeof content !== "string") {
            return json({ error: "Missing filePath or content" }, 400);
        }
        const page = await store.writeFile(filePath, content);
        return json({
            success: true,
            message: `Saved: ${page.path}`,
            path: page.path,
            type: page.type,
            updatedAt: page.updatedAt,
        });
    }
    catch (err) {
        return json({ error: err.message }, 500);
    }
}
async function handleRender(req) {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("file") || "about.md";
    try {
        let page;
        try {
            page = await store.readPage(filePath);
        }
        catch (err) {
            // Allow short names such as `hello-world` (resolved to posts/hello-world.md).
            if (!store.getExtension(filePath)) {
                page = await store.resolveFilePath(filePath);
            }
            else
                throw err;
        }
        return json(serializePage(page));
    }
    catch (err) {
        const message = err.message;
        return json({ error: message, path: filePath }, err instanceof store.NotFoundError ? 404 : 400);
    }
}
async function handleProject(req) {
    const url = new URL(req.url);
    const name = url.searchParams.get("name") || "";
    try {
        const page = await store.resolveProject(name);
        const data = serializePage(page);
        return json({
            ...data,
            projectName: name.toLowerCase(),
            // Projects are addressed by name, even when backed by index.html.
            path: `projects/${name.toLowerCase()}`,
            filePath: page.path,
        });
    }
    catch (err) {
        return json({ error: err.message, projectName: name }, 404);
    }
}
async function handlePosts() {
    try {
        const index = await getContentIndex();
        return json(index);
    }
    catch (err) {
        return json({ error: err.message }, 500);
    }
}

async function handleTree() {
    try {
        const [entries, projects] = await Promise.all([
            store.listAllEntries(),
            store.listProjects(),
        ]);
        return json({
            entries,
            projects,
            generatedAt: new Date().toISOString(),
        });
    }
    catch (err) {
        return json({ error: err.message }, 500);
    }
}
function handleSession(req) {
    const session = getSessionFromRequest(req);
    return json({
        loggedIn: !!session,
        username: session?.username || null,
        group: session?.group || "visitor",
        adminConfigured: isAdminConfigured(),
    });
}
