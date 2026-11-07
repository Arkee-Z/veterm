/**
 * Node HTTP bootstrap — loads users/database and starts the server.
 * Node's Web Request/Response globals let the routing layer stay runtime-neutral.
 */
import http from "node:http";
import { loadUsers } from "./server/auth.js";
import { handleRequest } from "./server/router.js";
import { closeDb, initDb } from "./db/database.js";

// Optional local .env; real deployments usually inject variables directly.
try {
    process.loadEnvFile(".env");
}
catch { /* .env is optional */ }

const MAX_BODY_BYTES = 5 * 1024 * 1024;
class PayloadTooLargeError extends Error {
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            if (size > MAX_BODY_BYTES)
                return;
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                req.pause();
                reject(new PayloadTooLargeError("Request body too large"));
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}
async function toWebRequest(req, port) {
    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = (Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto || "http").split(",")[0].trim();
    const host = req.headers.host || `localhost:${port}`;
    const url = new URL(req.url || "/", `${proto}://${host}`);
    const headers = new Headers();
    const hopByHop = new Set([
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
    ]);
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined || hopByHop.has(key.toLowerCase()))
            continue;
        headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    }
    const method = (req.method || "GET").toUpperCase();
    const body = method === "GET" || method === "HEAD"
        ? undefined
        : await readBody(req);
    return new Request(url, {
        method,
        headers,
        body: body && body.length > 0 ? body : undefined,
    });
}
async function sendWebResponse(res, response) {
    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
        if (key.toLowerCase() === "set-cookie")
            continue;
        res.setHeader(key, value);
    }
    const cookies = typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    if (cookies.length > 0)
        res.setHeader("set-cookie", cookies);
    if (!response.body || response.status === 204 || response.status === 304) {
        res.end();
        return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!res.hasHeader("content-length")) {
        res.setHeader("content-length", String(buffer.length));
    }
    res.end(buffer);
}
function sendError(res, status, message) {
    if (res.headersSent) {
        res.destroy();
        return;
    }
    res.statusCode = status;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("connection", "close");
    res.end(message);
}
export async function startServer() {
    await loadUsers();
    await initDb();
    const rawPort = process.env.PORT || "8000";
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT: ${rawPort}`);
    }
    const hostname = process.env.HOST || "0.0.0.0";
    const server = http.createServer(async (req, res) => {
        try {
            const request = await toWebRequest(req, port);
            const response = await handleRequest(request);
            await sendWebResponse(res, response);
        }
        catch (err) {
            if (err instanceof PayloadTooLargeError) {
                sendError(res, 413, "413 Payload Too Large");
                return;
            }
            console.error("Request error:", err);
            sendError(res, 500, "500 Internal Server Error");
        }
    });
    server.on("clientError", (err, socket) => {
        if (!socket.writable)
            return;
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, hostname, () => {
            server.off("error", reject);
            resolve();
        });
    });
    console.log(`Veterm — http://localhost:${port}`);
    let shuttingDown = false;
    let finished = false;
    const finish = () => {
        if (finished)
            return;
        finished = true;
        try {
            closeDb();
        }
        catch { /* already closed */ }
        process.exit(0);
    };
    const shutdown = (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        console.log(`\n${signal} received — graceful shutdown...`);
        server.close(finish);
        if (typeof server.closeAllConnections === "function") {
            server.closeAllConnections();
        }
        // Hard stop if a client refuses to release a keep-alive connection.
        setTimeout(finish, 2000).unref();
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    return server;
}
