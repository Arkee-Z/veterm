import { handleApi } from "./api.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function handleRequest(req: Request): Promise<Response> {
  const pathname = new URL(req.url).pathname;
  if (pathname.startsWith("/api/")) return handleApi(req, pathname);
  return serveStatic(pathname);
}

async function serveStatic(pathname: string): Promise<Response> {
  let fp = pathname;
  if (fp.includes("..") || fp.includes("~") || fp.includes("\x00")) {
    return new Response("403 Forbidden", { status: 403 });
  }
  if (fp === "/" || fp === "") fp = "/index.html";

  try {
    const file = await Deno.readFile(`./static${fp}`);
    const ext = fp.substring(fp.lastIndexOf("."));
    return new Response(file, { headers: { "Content-Type": MIME[ext] || "application/octet-stream" } });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      try {
        const file = await Deno.readFile("./static/index.html");
        return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch { return new Response("404 Not Found", { status: 404 }); }
    }
    return new Response("500 Internal Server Error", { status: 500 });
  }
}