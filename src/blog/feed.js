/**
 * RSS 2.0 and sitemap generation from the same content index as the UI.
 */
import { getContentIndex } from "./content.js";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function baseUrl(origin) {
  return String(origin || "").replace(/\/+$/, "");
}

function rfcDate(value) {
  const date = value ? new Date(`${value}T00:00:00Z`) : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toUTCString()
    : date.toUTCString();
}

export async function buildRss(origin) {
  const base = baseUrl(origin);
  const index = await getContentIndex();
  const posts = index.posts.slice(0, 50);
  const latest = posts[0]?.date || new Date().toISOString().slice(0, 10);

  const items = posts.map((post) => {
    const link = `${base}/posts/${encodeURIComponent(post.slug)}`;
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(`veterm:${post.path}`)}</guid>`,
      `      <pubDate>${rfcDate(post.date)}</pubDate>`,
      `      <description>${escapeXml(post.excerpt)}</description>`,
      ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
      "    </item>",
    ].join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Veterm — Terminal Blog Engine</title>
    <link>${escapeXml(`${base}/`)}</link>
    <description>Notes on systems, interfaces, and the web.</description>
    <language>en</language>
    <lastBuildDate>${rfcDate(latest)}</lastBuildDate>
    <generator>Veterm</generator>
${items}
  </channel>
</rss>
`;
}

export async function buildSitemap(origin) {
  const base = baseUrl(origin);
  const index = await getContentIndex();
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: `${base}/`, lastmod: today, priority: "1.0" },
    { loc: `${base}/archive`, lastmod: index.stats.latestDate || today, priority: "0.9" },
    { loc: `${base}/tags`, lastmod: today, priority: "0.7" },
    { loc: `${base}/projects`, lastmod: today, priority: "0.7" },
    { loc: `${base}/about`, lastmod: today, priority: "0.6" },
    ...index.posts.map((post) => ({
      loc: `${base}/posts/${encodeURIComponent(post.slug)}`,
      lastmod: post.date || today,
      priority: "0.8",
    })),
    ...index.projects.map((project) => ({
      loc: `${base}/projects/${encodeURIComponent(project.name)}`,
      lastmod: (project.updatedAt || "").slice(0, 10) || today,
      priority: "0.6",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`).join("\n")}
</urlset>
`;
}
