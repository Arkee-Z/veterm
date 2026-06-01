/**
 * Rate limiter — simple in-memory IP-based throttle.
 * Used by API routes to prevent brute-force.
 */
const rateLimitMap = new Map<string, number[]>();
const MAX = 30;
const WINDOW = 10_000; // 10s

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW * 2;
  for (const [ip, timestamps] of rateLimitMap) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, filtered);
    }
  }
}, 60_000); // every 60 seconds

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW);
  if (recent.length >= MAX) return false;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}
