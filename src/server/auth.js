/**
 * Authentication — PBKDF2 password hashing + in-memory sessions.
 *
 * The admin password is read from `VETERM_ADMIN_PASSWORD` (legacy:
 * `VETA_ADMIN_PASSWORD`). When it is missing, admin login stays disabled.
 */
import { randomUUID, webcrypto } from "node:crypto";
const crypto = globalThis.crypto ?? webcrypto;
const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 100_000;
let users = [];
let adminConfigured = false;
let guestPassword = "guest";
// --- PBKDF2 password hashing ---
const encoder = new TextEncoder();
function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
async function deriveHash(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const hash = await crypto.subtle.deriveBits({
        name: "PBKDF2",
        salt: salt.buffer,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
    }, keyMaterial, 256);
    return bytesToHex(new Uint8Array(hash));
}
async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    return { hash: await deriveHash(password, salt), salt: bytesToHex(salt) };
}
async function verifyPassword(password, storedHash, storedSalt) {
    const hash = await deriveHash(password, hexToBytes(storedSalt));
    return hash === storedHash;
}
export function isAdminConfigured() {
    return adminConfigured;
}
// --- User loading from environment variables ---
export async function loadUsers() {
    // Keep the old variable name working so existing deployments do not break.
    const adminPass = process.env.VETERM_ADMIN_PASSWORD ||
        process.env.VETA_ADMIN_PASSWORD || "";
    guestPassword = process.env.VETERM_GUEST_PASSWORD || "guest";
    adminConfigured = adminPass.length > 0;
    if (!adminConfigured) {
        console.warn("WARNING: VETERM_ADMIN_PASSWORD is not set. Admin login is disabled.\n" +
            "         Create a .env file next to main.js (see .env.example).");
    }
    else if (adminPass.length < 8) {
        console.warn("WARNING: VETERM_ADMIN_PASSWORD is shorter than 8 characters.");
    }
    // A random password keeps the admin account unusable when no secret is set.
    const admin = await hashPassword(adminPass || randomUUID());
    const guest = await hashPassword(guestPassword);
    users = [
        {
            username: "admin",
            passwordHash: admin.hash,
            salt: admin.salt,
            group: "admin",
        },
        {
            username: "guest",
            passwordHash: guest.hash,
            salt: guest.salt,
            group: "visitor",
        },
    ];
    console.log(`Users initialized (admin${adminConfigured ? "" : " disabled"} + guest).`);
}
export function findUser(username) {
    return users.find((u) => u.username === username);
}
export async function verifyUser(username, password) {
    const user = findUser(username);
    // Always spend the hashing time to avoid a cheap username oracle.
    const fallbackSalt = new Uint8Array(32);
    if (!user) {
        await deriveHash(password, fallbackSalt);
        return null;
    }
    const valid = await verifyPassword(password, user.passwordHash, user.salt);
    return valid ? user : null;
}
// --- Session management ---
const sessions = new Map();
function generateSessionId() {
    return randomUUID();
}
export function createSession(user) {
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
        username: user.username,
        group: user.group,
        createdAt: Date.now(),
    });
    return sessionId;
}
export function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session)
        return undefined;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        return undefined;
    }
    return session;
}
export function destroySession(sessionId) {
    sessions.delete(sessionId);
}
/** Extract the raw session id from a request cookie header. */
export function getSessionIdFromRequest(req) {
    const cookie = req.headers.get("cookie");
    if (!cookie)
        return undefined;
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (!match)
        return undefined;
    try {
        return decodeURIComponent(match[1]);
    }
    catch {
        return match[1];
    }
}
export function getSessionFromRequest(req) {
    const sessionId = getSessionIdFromRequest(req);
    return sessionId ? getSession(sessionId) : undefined;
}
// --- Cookie helpers ---
export function isSecureRequest(req) {
    const forwarded = req.headers.get("x-forwarded-proto");
    if (forwarded)
        return forwarded.split(",")[0].trim() === "https";
    try {
        return new URL(req.url).protocol === "https:";
    }
    catch {
        return false;
    }
}
export function buildSessionCookie(sessionId, req) {
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}
export function buildClearSessionCookie(req) {
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
