/**
 * Content index for the public site: posts, tags, projects and stats.
 *
 * The filesystem + SQLite store remains the source of truth; this module turns
 * it into the metadata the reading UI needs (dates, excerpts, reading time,
 * tags, project cards).
 */
import * as store from "./store.js";
import {
  firstHeading,
  normalizeDate,
  normalizeTags,
  parseFrontMatter,
  plainText,
  readingTime,
} from "./meta.js";

function titleFromPage(page) {
  if (!page) return "";
  if (page.type === "html") {
    const match = page.content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (match) return match[1].trim();
  }
  return firstHeading(page.content) || page.path.split("/").pop() || page.path;
}

function slugFromPath(path) {
  return (path.split("/").pop() || path).replace(/\.md$/i, "");
}

async function collectPosts() {
  const entries = await store.listAllEntries();
  const files = entries.filter((entry) =>
    !entry.isDirectory && entry.path.startsWith("posts/") &&
    entry.path.toLowerCase().endsWith(".md")
  );

  const posts = [];
  for (const file of files) {
    let page;
    try {
      page = await store.readPage(file.path);
    } catch {
      continue;
    }

    const { data, body } = parseFrontMatter(page.content);
    if (data.draft === true || data.draft === "true") continue;

    const text = plainText(body);
    const date = normalizeDate(data.date) || normalizeDate(page.updatedAt) ||
      normalizeDate(file.updatedAt) || "";
    const tags = normalizeTags(data.tags);
    const title = String(data.title || firstHeading(body) || slugFromPath(file.path));
    const slug = String(data.slug || slugFromPath(file.path));
    const excerpt = String(data.description || text.slice(0, 220)).trim();

    posts.push({
      path: file.path,
      slug,
      title,
      date,
      updatedAt: page.updatedAt || file.updatedAt || "",
      excerpt,
      tags,
      readingTime: readingTime(body),
      featured: data.featured === true || data.featured === "true",
      searchText: `${title} ${tags.join(" ")} ${text}`.slice(0, 6000),
      type: "post",
    });
  }

  posts.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.title.localeCompare(b.title);
  });
  return posts;
}

function normalizeProjectMeta(meta, fallback) {
  const tags = normalizeTags(meta.tags);
  return {
    ...fallback,
    title: String(meta.title || fallback.title),
    description: String(meta.description || fallback.description),
    tags,
    url: String(meta.url || fallback.url || ""),
    featured: meta.featured === true || meta.featured === "true",
    order: Number.isFinite(Number(meta.order)) ? Number(meta.order) : 999,
    cover: String(meta.cover || ""),
  };
}

async function collectProjects(names) {
  const projects = [];
  for (const name of names) {
    let page = null;
    try {
      page = await store.resolveProject(name);
    } catch {
      continue;
    }

    let meta = {};
    try {
      const metaPage = await store.readPage(`projects/${name}/meta.json`);
      meta = JSON.parse(metaPage.content);
    } catch { /* metadata is optional */ }

    const link = store.pageLink(page);
    const type = link ? "link" : page.type;
    const fallback = {
      name,
      path: `projects/${name}`,
      title: name.replace(/(^|-)([a-z])/g, (_, dash, letter) =>
        `${dash ? " " : ""}${letter.toUpperCase()}`
      ),
      description: link
        ? `External link · ${link}`
        : type === "html"
        ? "An interactive HTML project mounted inside Veterm."
        : "A mounted markdown project.",
      tags: [],
      url: link || "",
      type,
      featured: false,
      updatedAt: page.updatedAt || "",
      searchText: `${name} ${type} ${link || ""}`,
    };

    const project = normalizeProjectMeta(meta, fallback);
    projects.push({
      ...project,
      searchText: `${project.title} ${project.description} ${project.tags.join(" ")} ${
        project.url || ""
      }`.slice(0, 3000),
    });
  }

  projects.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
  return projects;
}

export async function getContentIndex() {
  const [posts, projectNames] = await Promise.all([
    collectPosts(),
    store.listProjects(),
  ]);
  const projects = await collectProjects(projectNames);

  const tagCounts = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const totalWords = posts.reduce((sum, post) => sum + post.readingTime * 220, 0);

  return {
    posts,
    tags,
    projects,
    stats: {
      posts: posts.length,
      tags: tags.length,
      projects: projects.length,
      words: totalWords,
      latestDate: posts[0]?.date || "",
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function findPostByPath(path) {
  const index = await getContentIndex();
  return index.posts.find((post) => post.path === path) || null;
}
