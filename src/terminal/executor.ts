/**
 * Thin command executor — delegates to the command registry.
 * All permission checks are embedded in the registry entries.
 */
import { getSessionFromRequest } from "../server/auth.ts";
import { findCommand } from "./commands.ts";
import type { CommandResult, CommandContext } from "./commands.ts";
import type { UserGroup } from "./permissions.ts";

export type { CommandResult } from "./commands.ts";

function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; } else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) { args.push(current); current = ""; }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

export async function executeCommand(
  input: string,
  req: Request,
): Promise<CommandResult> {
  const parts = parseArgs(input.trim());
  if (parts.length === 0) return { output: "" };

  const name = parts[0].toLowerCase();
  const args = parts.slice(1);
  const session = getSessionFromRequest(req);
  const group: UserGroup = session?.group || "visitor";

  const def = findCommand(name);
  if (!def) {
    return { output: `Command not found: ${name}. Type 'help' for available commands.` };
  }

  // Enforce permission: "admin" → admin only; "all" → everyone
  if (def.group === "admin" && group !== "admin") {
    return { output: `Permission denied: ${name} requires admin privileges.` };
  }

  const ctx: CommandContext = { group, session, req };
  return def.handler(args, ctx);
}