import { readFile, stat } from "node:fs/promises";
import { handleApi } from "./api.js";
import { buildRss, buildSitemap } from "../blog/feed.js";
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
};
const SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
};
export async function handleRequest(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
        try {
            return await handleApi(req, url.pathname);
        }
        catch (err) {
            console.error("API error:", err);
            return new Response(JSON.stringify({ error: "Internal server error" }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store",
                },
            });
        }
    }
    if (url.pathname === "/rss.xml" || url.pathname === "/feed.xml") {
        return await serveFeed(url, "rss");
    }
    if (url.pathname === "/sitemap.xml") {
        return await serveFeed(url, "sitemap");
    }
    if (url.pathname === "/robots.txt") {
        const base = siteOrigin(url);
        return new Response(
            `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
            {
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Cache-Control": "public, max-age=300",
                },
            },
        );
    }
    try {
        return await serveStatic(req, url.pathname);
    }
    catch (err) {
        console.error("Static error:", err);
        return await errorPage(500);
    }
}

function siteOrigin(url) {
    const configured = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
    return configured || url.origin;
}

async function serveFeed(url, kind) {
    try {
        const origin = siteOrigin(url);
        if (kind === "sitemap") {
            const xml = await buildSitemap(origin);
            return new Response(xml, {
                headers: {
                    "Content-Type": "application/xml; charset=utf-8",
                    "Cache-Control": "public, max-age=300",
                },
            });
        }
        const xml = await buildRss(origin);
        return new Response(xml, {
            headers: {
                "Content-Type": "application/rss+xml; charset=utf-8",
                "Cache-Control": "public, max-age=300",
            },
        });
    }
    catch (err) {
        console.error("Feed error:", err);
        return new Response("Could not generate feed", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }
}
function safeStaticPath(pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    }
    catch {
        return null;
    }
    if (decoded.includes("\x00") || decoded.includes("\\"))
        return null;
    const segments = decoded.split("/").filter(Boolean);
    // Block traversal and dotfiles (.env, .git, ...).
    if (segments.some((segment) => segment === ".." || segment === "." || segment.startsWith("."))) {
        return null;
    }
    return `/${segments.join("/")}`;
}
export function isAppRoute(pathname) {
    if (!pathname || pathname === "/")
        return true;
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0] || "";
    // Static asset directories must 404 rather than returning the app shell.
    if (["css", "js", "assets", "images", "img", "fonts"].includes(first))
        return false;
    // Known client routes win even when the final segment contains a dot
    // (for example /archive/node.js or /projects/foo/index.html).
    if (["archive", "tags", "projects", "about", "posts", "post", "p"].includes(first))
        return true;
    const last = segments[segments.length - 1] || "";
    return !last.includes(".");
}

async function serveStatic(req, pathname) {
    const safePath = safeStaticPath(pathname);
    if (!safePath)
        return await errorPage(403);
    const filePath = safePath === "/" || safePath === ""
        ? "/index.html"
        : safePath;
    const fullPath = `./static${filePath}`;
    let info;
    try {
        info = await stat(fullPath);
        if (info.isDirectory())
            return await errorPage(404);
    }
    catch (err) {
        if (err.code === "ENOENT") {
            if (isAppRoute(safePath))
                return await serveStatic(req, "/index.html");
            return await errorPage(404);
        }
        return await errorPage(500);
    }
    const etag = `"${Math.floor(info.mtimeMs)}-${info.size}"`;
    if (req.headers.get("if-none-match") === etag) {
        return new Response(null, {
            status: 304,
            headers: { ETag: etag, ...SECURITY_HEADERS },
        });
    }
    let file;
    try {
        file = await readFile(fullPath);
    }
    catch {
        return await errorPage(500);
    }
    const extension = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
    const headers = {
        "Content-Type": MIME[extension] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "ETag": etag,
        ...SECURITY_HEADERS,
    };
    if (req.method === "HEAD") {
        headers["Content-Length"] = String(info.size);
        return new Response(null, { status: 200, headers });
    }
    return new Response(file, { headers });
}
async function errorPage(status) {
    const page = status === 404
        ? "./static/404.html"
        : status === 403
            ? "./static/403.html"
            : "./static/500.html";
    const fallback = status === 404
        ? "404 Not Found"
        : status === 403
            ? "403 Forbidden"
            : "500 Internal Server Error";
    try {
        const file = await readFile(page);
        return new Response(file, {
            status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
                ...SECURITY_HEADERS,
            },
        });
    }
    catch {
        return new Response(fallback, {
            status,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                ...SECURITY_HEADERS,
            },
        });
    }
}
