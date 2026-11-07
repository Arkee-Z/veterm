/**
 * In-memory throttles.
 * - API requests: 60 requests / 10s per IP (autocomplete and navigation friendly)
 * - Login attempts: 8 failures / 5min per IP
 */
const apiHits = new Map();
const loginFailures = new Map();
const API_MAX = 60;
const API_WINDOW = 10_000;
const LOGIN_MAX = 8;
const LOGIN_WINDOW = 5 * 60_000;
function prune(map, windowMs) {
    const cutoff = Date.now() - windowMs * 2;
    for (const [ip, timestamps] of map) {
        const kept = timestamps.filter((t) => t > cutoff);
        if (kept.length === 0)
            map.delete(ip);
        else
            map.set(ip, kept);
    }
}
// Periodic cleanup to prevent unbounded memory growth.
// Unref the timer so it does not keep the process alive during shutdown.
const cleanupTimer = setInterval(() => {
    prune(apiHits, API_WINDOW);
    prune(loginFailures, LOGIN_WINDOW);
}, 60_000);
if (typeof cleanupTimer.unref === "function")
    cleanupTimer.unref();
/** Best-effort client IP, compatible with proxies. */
export function getClientIp(req) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded)
        return forwarded.split(",")[0].trim();
    return req.headers.get("cf-connecting-ip") || "127.0.0.1";
}
export function checkRateLimit(ip) {
    const now = Date.now();
    const recent = (apiHits.get(ip) || []).filter((t) => now - t < API_WINDOW);
    if (recent.length >= API_MAX)
        return false;
    recent.push(now);
    apiHits.set(ip, recent);
    return true;
}
export function isLoginBlocked(ip) {
    const now = Date.now();
    const recent = (loginFailures.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW);
    loginFailures.set(ip, recent);
    return recent.length >= LOGIN_MAX;
}
export function recordLoginFailure(ip) {
    const now = Date.now();
    const recent = (loginFailures.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW);
    recent.push(now);
    loginFailures.set(ip, recent);
}
export function clearLoginFailures(ip) {
    loginFailures.delete(ip);
}
