/**
 * Metadata helpers: a deliberately small front-matter parser plus text
 * utilities shared by the renderer, index, feed, and terminal.
 */

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function unquote(value) {
  const text = String(value ?? "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function parseValue(value) {
  const text = unquote(value);
  if (!text) return "";
  if (text.startsWith("[") && text.endsWith("]")) {
    return text
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item))
      .filter(Boolean);
  }
  if (/^(true|yes)$/i.test(text)) return true;
  if (/^(false|no)$/i.test(text)) return false;
  return text;
}

function parseYamlLite(block) {
  const data = {};
  let currentKey = null;

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(listItem[1]));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2].trim();
    currentKey = key;

    if (!value) {
      data[key] = [];
      continue;
    }

    let parsed = parseValue(value);
    if (key === "tags" && typeof parsed === "string") {
      parsed = parsed.split(",").map((tag) => unquote(tag)).filter(Boolean);
    }
    data[key] = parsed;
  }

  return data;
}

export function parseFrontMatter(source) {
  const text = String(source ?? "").replace(/^\uFEFF/, "");
  const match = text.match(FRONT_MATTER_RE);
  if (!match) return { data: {}, body: text };
  return {
    data: parseYamlLite(match[1]),
    body: text.slice(match[0].length),
  };
}

export function stripFrontMatter(source) {
  return parseFrontMatter(source).body;
}

export function slugify(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "section";
}

/** Plain text used for excerpts, search and reading-time estimates. */
export function plainText(source) {
  let text = stripFrontMatter(String(source ?? ""));
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^[-*+]\s+/gm, "");
  text = text.replace(/^\d+[.)]\s+/gm, "");
  text = text.replace(/[*_~]{1,3}/g, "");
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, " ");
  return text.replace(/\s+/g, " ").trim();
}

export function countWords(source) {
  const text = plainText(source);
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin = text
    .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

export function readingTime(source) {
  return Math.max(1, Math.round(countWords(source) / 220));
}

export function firstHeading(source) {
  let inCode = false;
  for (const line of stripFrontMatter(String(source ?? "")).split("\n")) {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const heading = line.match(/^\s*#{1,3}\s+(.+?)(?:\s+#+)?\s*$/);
    if (heading) return heading[1].replace(/[*_`]/g, "").trim();
  }
  return "";
}

export function normalizeDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function normalizeTags(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(
    list
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean),
  )];
}
