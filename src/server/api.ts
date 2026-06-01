import { executeCommand } from "../terminal/executor.ts";
import * as store from "../blog/store.ts";
import { renderMarkdown } from "../blog/render.ts";
import { getSessionFromRequest } from "./auth.ts";
import { checkRateLimit } from "./middleware.ts";

export async function handleApi(req: Request, pathname: string): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

  switch (true) {
    // POST /api/cmd
    case pathname === "/api/cmd" && req.method === "POST":
      if (!checkRateLimit(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });
      return handleCmd(req);

    // POST /api/save
    case pathname === "/api/save" && req.method === "POST":
      return handleSave(req);

    // GET /api/render?file=...
    case pathname === "/api/render" && req.method === "GET":
      if (!checkRateLimit(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });
      return handleRender(req);

    // GET /api/session
    case pathname === "/api/session" && req.method === "GET":
      return handleSession(req);

    default:
      return Response.json({ error: "Not found" }, { status: 404 });
  }
}

async function handleCmd(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { command } = body;
    if (!command || typeof command !== "string") {
      return Response.json({ error: "Missing command" }, { status: 400 });
    }
    const result = await executeCommand(command, req);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (result.sessionCookie) headers["Set-Cookie"] = result.sessionCookie;
    return new Response(JSON.stringify(result), { headers });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function handleSave(req: Request): Promise<Response> {
  const session = getSessionFromRequest(req);
  if (!session || session.group === "visitor") {
    return Response.json({ error: "Permission denied" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { filePath, content } = body;
    if (!filePath || content === undefined) {
      return Response.json({ error: "Missing filePath or content" }, { status: 400 });
    }
    await store.writeFile(filePath, content);
    return Response.json({ success: true, message: `Saved: ${filePath}` });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function handleRender(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("file") || "about.md";
    const session = getSessionFromRequest(req);
    const group = session?.group || "visitor";
    if (group === "visitor" && filePath !== "about.md") {
      return Response.json({ error: "Permission denied" }, { status: 403 });
    }
    const content = await store.readFile(filePath);
    const html = renderMarkdown(content);
    return Response.json({ content, html, filePath });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}

function handleSession(req: Request): Response {
  const session = getSessionFromRequest(req);
  return Response.json({
    loggedIn: !!session,
    username: session?.username || null,
    group: session?.group || "visitor",
  });
}