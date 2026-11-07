import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/blog/render.js";

test("renders headings, paragraphs, and lists", () => {
  const html = renderMarkdown("# Title\n\nHello **world**.\n\n- one\n- two");
  assert.match(html, /<h1 id="title">Title<\/h1>/);
  assert.match(html, /<p>Hello <strong>world<\/strong>.<\/p>/);
  assert.match(html, /<ul>\s*<li>one<\/li>\s*<li>two<\/li>\s*<\/ul>/);
});

test("merges consecutive paragraph lines", () => {
  const html = renderMarkdown("first line\nsecond line");
  assert.equal(html, "<p>first line second line</p>");
});

test("keeps inline SVG icons in the about page", () => {
  const html = renderMarkdown(
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/></svg> Chengdu, China  \nNext line',
  );
  assert.match(html, /<svg/);
  assert.match(html, /Chengdu, China/);
  assert.match(html, /<br>/);
});

test("escapes fenced code", () => {
  const html = renderMarkdown("```html\n<script>alert(1)</script>\n```");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("strips front matter and creates heading ids", () => {
  const html = renderMarkdown("---\ntitle: Hidden\n---\n\n## The Shape of the Server");
  assert.doesNotMatch(html, /title: Hidden/);
  assert.match(html, /<h2 id="the-shape-of-the-server">/);
});

test("sanitizes active HTML blocks", () => {
  const html = renderMarkdown(
    '<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[bad](javascript:alert(3))',
  );
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /onerror/);
  assert.doesNotMatch(html, /javascript:/i);
});
