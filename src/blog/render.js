/**
 * Small, dependency-free Markdown → HTML renderer.
 *
 * Supports headings, paragraphs, bold/italic/strikethrough, inline code,
 * fenced code blocks, links, images, blockquotes, horizontal rules, and
 * ordered/unordered lists. Raw HTML blocks (used by the about page for inline
 * SVG icons) are passed through untouched.
 */
import { slugify, stripFrontMatter } from "./meta.js";

export function renderMarkdown(md) {
    const source = stripFrontMatter(String(md ?? ""));
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    const usedHeadingIds = new Map();
    const headingId = (text) => {
        const base = slugify(String(text).replace(/<[^>]+>/g, "").replace(/[*_`~]/g, ""));
        let id = base;
        let suffix = 2;
        while (usedHeadingIds.has(id)) id = `${base}-${suffix++}`;
        usedHeadingIds.set(id, true);
        return id;
    };
    const html = [];
    let paragraph = [];
    let listType = null;
    let quoteLines = [];
    let codeBlock = null;
    const flushParagraph = () => {
        if (paragraph.length === 0)
            return;
        let content = "";
        for (let i = 0; i < paragraph.length; i++) {
            if (i > 0)
                content += paragraph[i - 1].hardBreak ? "<br>" : " ";
            content += renderInline(paragraph[i].text);
        }
        html.push(`<p>${content}</p>`);
        paragraph = [];
    };
    const flushList = () => {
        if (!listType)
            return;
        html.push(`</${listType}>`);
        listType = null;
    };
    const flushQuote = () => {
        if (quoteLines.length === 0)
            return;
        html.push(`<blockquote>${quoteLines.map((line) => renderInline(line)).join("<br>")}</blockquote>`);
        quoteLines = [];
    };
    const flushAll = () => {
        flushParagraph();
        flushList();
        flushQuote();
    };
    for (const rawLine of lines) {
        const line = rawLine.trim();
        // Fenced code blocks
        if (codeBlock) {
            if (line.startsWith("```")) {
                const langClass = codeBlock.lang
                    ? ` class="language-${escapeHtml(codeBlock.lang)}"`
                    : "";
                html.push(`<pre><code${langClass}>${escapeHtml(codeBlock.lines.join("\n"))}</code></pre>`);
                codeBlock = null;
            }
            else {
                codeBlock.lines.push(rawLine);
            }
            continue;
        }
        if (line.startsWith("```")) {
            flushAll();
            const lang = line.slice(3).trim().split(/\s+/)[0];
            codeBlock = {
                lang: /^[a-z0-9+#.-]+$/i.test(lang) ? lang : "",
                lines: [],
            };
            continue;
        }
        // Blank line closes every open block
        if (!line) {
            flushAll();
            continue;
        }
        // Block-level raw HTML is emitted as-is; inline HTML (the about page's
        // SVG icons) stays part of the surrounding paragraph so text lines up.
        const inlineHtml = /^<(?:svg|span|a|img|code|b|strong|i|em|small|sup|sub|kbd|mark|del|br)\b/i;
        if (line.startsWith("<") && !inlineHtml.test(line)) {
            flushAll();
            html.push(line);
            continue;
        }
        // Blockquote
        if (line.startsWith(">")) {
            flushParagraph();
            flushList();
            quoteLines.push(line.replace(/^>\s?/, ""));
            continue;
        }
        if (quoteLines.length > 0)
            flushQuote();
        // Horizontal rule
        if (/^(?:[-*_]\s*){3,}$/.test(line)) {
            flushAll();
            html.push("<hr>");
            continue;
        }
        // Heading
        const heading = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
        if (heading) {
            flushAll();
            const level = heading[1].length;
            const id = headingId(heading[2]);
            html.push(`<h${level} id="${escapeHtml(id)}">${renderInline(heading[2])}</h${level}>`);
            continue;
        }
        // Lists
        const unordered = line.match(/^[-*+]\s+(.+)$/);
        const ordered = line.match(/^\d+[.)]\s+(.+)$/);
        if (unordered || ordered) {
            flushParagraph();
            flushQuote();
            const type = unordered ? "ul" : "ol";
            if (!listType || listType !== type) {
                flushList();
                html.push(`<${type}>`);
                listType = type;
            }
            html.push(`<li>${renderInline((unordered || ordered)[1])}</li>`);
            continue;
        }
        if (listType)
            flushList();
        // Paragraph text: two trailing spaces mean a hard line break.
        paragraph.push({
            text: line,
            hardBreak: / {2,}$/.test(rawLine),
        });
    }
    if (codeBlock) {
        html.push(`<pre><code>${escapeHtml(codeBlock.lines.join("\n"))}</code></pre>`);
    }
    flushAll();
    return sanitizeHtml(html.join("\n"));
}
function renderInline(text) {
    // Inline code is protected first so emphasis/link syntax inside it stays literal.
    const codeSpans = [];
    let result = text.replace(/`([^`]+)`/g, (_match, code) => {
        const token = `\uE000${codeSpans.length}\uE001`;
        codeSpans.push(`<code>${escapeHtml(code)}</code>`);
        return token;
    });
    result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    // Images first (they also match the link pattern).
    result = result.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, alt, src) => `<img src="${escapeHtml(safeUrl(src))}" alt="${escapeHtml(alt)}" loading="lazy">`);
    result = result.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, label, href) => {
        const url = safeUrl(href);
        const external = /^https?:\/\//i.test(url);
        const attrs = external
            ? ' target="_blank" rel="noopener noreferrer"'
            : "";
        return `<a href="${escapeHtml(url)}"${attrs}>${label}</a>`;
    });
    result = result.replace(/\uE000(\d+)\uE001/g, (_match, index) => codeSpans[Number(index)] || "");
    return result;
}
/**
 * Remove active content from raw HTML blocks.
 * Markdown pages are allowed to contain inline SVG (the about page does), but
 * not scripts, frames, forms, or event-handler attributes.
 */
function sanitizeHtml(html) {
    let clean = html.replace(/<!--[\s\S]*?-->/g, "");
    // Drop dangerous containers together with their contents.
    clean = clean.replace(/<(script|style|iframe|object|embed|form|textarea|select|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    // Drop remaining standalone dangerous tags.
    clean = clean.replace(/<(script|style|iframe|object|embed|form|input|textarea|select|button|link|meta|base)\b[^>]*\/?>/gi, "");
    // Remove inline event handlers (onclick, onerror, ...).
    clean = clean.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    // Neutralise script-bearing URL schemes.
    clean = clean.replace(/\b(href|src|xlink:href|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi, '$1="#"');
    return clean;
}
function safeUrl(url) {
    const value = url.trim();
    if (/^(https?:|mailto:|tel:|\/|#|\.\.?\/)/i.test(value))
        return value;
    return "#";
}
function escapeHtml(text) {
    const map = {
        [String.fromCharCode(38)]: String.fromCharCode(38) + "amp;",
        [String.fromCharCode(60)]: String.fromCharCode(38) + "lt;",
        [String.fromCharCode(62)]: String.fromCharCode(38) + "gt;",
        [String.fromCharCode(34)]: String.fromCharCode(38) + "quot;",
        [String.fromCharCode(39)]: String.fromCharCode(38) + "#39;",
    };
    return text.replace(/[&<>"']/g, (ch) => map[ch] || ch);
}
