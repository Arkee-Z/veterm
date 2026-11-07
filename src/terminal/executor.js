/**
 * Thin command executor — delegates to the command registry.
 * All permission checks are embedded in the registry entries.
 */
import { getSessionFromRequest } from "../server/auth.js";
import { findCommand } from "./commands.js";
function parseArgs(input) {
    const args = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";
    for (const ch of input) {
        if (inQuote) {
            if (ch === quoteChar)
                inQuote = false;
            else
                current += ch;
        }
        else if (ch === '"' || ch === "'") {
            inQuote = true;
            quoteChar = ch;
        }
        else if (ch === " " || ch === "\t") {
            if (current) {
                args.push(current);
                current = "";
            }
        }
        else {
            current += ch;
        }
    }
    if (current)
        args.push(current);
    return args;
}
export async function executeCommand(input, req) {
    const parts = parseArgs(input.trim());
    if (parts.length === 0)
        return { output: "" };
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);
    const session = getSessionFromRequest(req);
    const group = session?.group || "visitor";
    const def = findCommand(name);
    if (!def) {
        return {
            output: `Command not found: ${name}. Type 'help' for available commands.`,
            error: true,
        };
    }
    // Enforce permission: "admin" → admin only; "all" → everyone
    if (def.group === "admin" && group !== "admin") {
        return {
            output: `Permission denied: ${name} requires admin privileges. Log in with 'login admin <password>' first.`,
            error: true,
        };
    }
    const ctx = { group, session, req };
    return await def.handler(args, ctx);
}
