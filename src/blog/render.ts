/**
 * Simple Markdown to HTML renderer.
 * Supports: headings, bold, italic, code blocks, inline code, links, images,
 * blockquotes, horizontal rules, unordered/ordered lists, paragraphs.
 */
export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let inList = false;
  let listType = ""; // "ul" or "ol"
  let inBlockquote = false;
  let blockquoteContent = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block (fenced)
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        if (inList) {
          html.push(`</${listType}>`);
          inList = false;
          listType = "";
        }
        if (inBlockquote) {
          html.push(`<blockquote>${renderInline(blockquoteContent)}</blockquote>`);
          inBlockquote = false;
          blockquoteContent = "";
        }
        inCodeBlock = true;
        codeContent = "";
        continue;
      } else {
        html.push(
          `<pre><code>${escapeHtml(codeContent).replace(/\n$/, "")}</code></pre>`,
        );
        inCodeBlock = false;
        continue;
      }
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === "") {
      if (inList) {
        html.push(`</${listType}>`);
        inList = false;
        listType = "";
      }
      if (inBlockquote) {
        html.push(`<blockquote>${renderInline(blockquoteContent)}</blockquote>`);
        inBlockquote = false;
        blockquoteContent = "";
      }
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      if (!inBlockquote) {
        if (inList) {
          html.push(`</${listType}>`);
          inList = false;
          listType = "";
        }
        inBlockquote = true;
        blockquoteContent = "";
      }
      blockquoteContent += (blockquoteContent ? "\n" : "") +
        trimmed.replace(/^>\s?/, "");
      continue;
    } else if (inBlockquote) {
      html.push(`<blockquote>${renderInline(blockquoteContent)}</blockquote>`);
      inBlockquote = false;
      blockquoteContent = "";
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      if (inList) {
        html.push(`</${listType}>`);
        inList = false;
        listType = "";
      }
      html.push("<hr>");
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) {
        html.push(`</${listType}>`);
        inList = false;
        listType = "";
      }
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[\-\*\+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList) html.push(`</${listType}>`);
        html.push("<ul>");
        inList = true;
        listType = "ul";
      }
      html.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        if (inList) html.push(`</${listType}>`);
        html.push("<ol>");
        inList = true;
        listType = "ol";
      }
      html.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    // Regular paragraph
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
      listType = "";
    }
    // Don't wrap raw HTML (SVG/icons) in <p>
    if (/^<[a-zA-Z]/.test(trimmed) && !/^<[a-z]+\s/.test(trimmed)) {
      html.push(trimmed);
    } else {
      html.push(`<p>${renderInline(trimmed)}</p>`);
    }
  }

  if (inCodeBlock) {
    html.push(
      `<pre><code>${escapeHtml(codeContent).replace(/\n$/, "")}</code></pre>`,
    );
  }
  if (inList) {
    html.push(`</${listType}>`);
  }
  if (inBlockquote) {
    html.push(`<blockquote>${renderInline(blockquoteContent)}</blockquote>`);
  }

  return html.join("\n");
}

function renderInline(text: string): string {
  let result = text;

  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return result;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    [String.fromCharCode(38)]: String.fromCharCode(38) + "amp;",
    [String.fromCharCode(60)]: String.fromCharCode(38) + "lt;",
    [String.fromCharCode(62)]: String.fromCharCode(38) + "gt;",
    [String.fromCharCode(34)]: String.fromCharCode(38) + "quot;",
  };
  return text.replace(/[&<>"]/g, (ch) => map[ch] || ch);
}
