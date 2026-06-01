/**
 * Application bootstrap — loads users, starts HTTP server.
 * Called from main.ts.
 */
import { loadUsers } from "./server/auth.ts";
import { handleRequest } from "./server/router.ts";

let loaded = false;

export async function bootstrap(): Promise<void> {
  if (!loaded) {
    await loadUsers();
    loaded = true;
    console.log("Users initialized.");
  }
  console.log("VETA Blog — http://localhost:8000");

  const ac = new AbortController();

  const shutdown = () => {
    console.log("\nGraceful shutdown...");
    ac.abort();
  };
  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  Deno.serve({ signal: ac.signal }, (req: Request) => handleRequest(req));
}