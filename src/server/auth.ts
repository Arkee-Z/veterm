interface User {
  username: string;
  passwordHash: string;
  salt: string;
  group: "admin" | "visitor";
}

let users: User[] = [];

// --- PBKDF2 password hashing ---
const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return {
    hash: bytesToHex(new Uint8Array(hash)),
    salt: bytesToHex(salt),
  };
}

async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const salt = hexToBytes(storedSalt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return bytesToHex(new Uint8Array(hash)) === storedHash;
}

// --- User loading from environment variables ---
export async function loadUsers(): Promise<void> {
  const adminPass = Deno.env.get("VETA_ADMIN_PASSWORD") || "";

  if (!adminPass) {
    console.warn(
      "WARNING: VETA_ADMIN_PASSWORD not set. Admin login disabled. Set this env var to enable admin access.",
    );
  }

  const admin = await hashPassword(adminPass || crypto.randomUUID());
  const guest = await hashPassword("guest");

  users = [
    { username: "admin", passwordHash: admin.hash, salt: admin.salt, group: "admin" },
    { username: "guest", passwordHash: guest.hash, salt: guest.salt, group: "visitor" },
  ];

  console.log("Users initialized (admin + guest).");
}

export function findUser(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const user = findUser(username);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash, user.salt);
  return valid ? user : null;
}

// --- Session management ---
const sessions = new Map<string, Session>();

interface Session {
  username: string;
  group: "admin" | "visitor";
  createdAt: number;
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

export function createSession(user: User): string {
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    username: user.username,
    group: user.group,
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionFromRequest(req: Request): Session | undefined {
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return undefined;
  return getSession(match[1]);
}