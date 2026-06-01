/**
 * Application bootstrap — loads users, starts HTTP server.
 * Called from main.ts.
 */
import { loadUsers } from "./server/auth.ts";
import { handleRequest } from "./server/router.ts";
import { initDb } from "./db/database.ts";

let loaded = false;

export async function bootstrap(): Promise<void> {
  if (!loaded) {
    await loadUsers();
    await initDb();
    loaded = true;
    console.log("Users initialized.");
  }
  console.log("VETA Blog — http://localhost:8000");

  const ac = new AbortController();

  // Signal listeners are not available on Deno Deploy
  if (typeof Deno.addSignalListener === "function") {
    const shutdown = () => {
      console.log("\nGraceful shutdown...");
      ac.abort();
    };
    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);
  }

  Deno.serve({ signal: ac.signal }, (req: Request) => handleRequest(req));
}