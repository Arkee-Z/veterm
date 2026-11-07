import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontMatter,
  plainText,
  readingTime,
  normalizeTags,
  slugify,
} from "../src/blog/meta.js";

test("parses front matter scalars, arrays and booleans", () => {
  const source = `---
title: A quiet note
date: 2026-10-02
tags: [design, css]
featured: true
draft: false
---
Body text.`;
  const { data, body } = parseFrontMatter(source);
  assert.equal(data.title, "A quiet note");
  assert.equal(data.date, "2026-10-02");
  assert.deepEqual(data.tags, ["design", "css"]);
  assert.equal(data.featured, true);
  assert.equal(data.draft, false);
  assert.equal(body, "Body text.");
});

test("supports list-style front matter", () => {
  const { data } = parseFrontMatter("---\ntags:\n  - node\n  - sqlite\n---\n");
  assert.deepEqual(data.tags, ["node", "sqlite"]);
});

test("plainText strips markup and code", () => {
  const text = plainText("---\ntitle: x\n---\n# Heading\n\n**Bold** and `code` and [link](https://x.test).\n\n```js\nconst x = 1\n```");
  assert.match(text, /Heading/);
  assert.match(text, /Bold and code and link/);
  assert.doesNotMatch(text, /const x/);
});

test("reading time and tags", () => {
  assert.equal(readingTime("one two three"), 1);
  assert.deepEqual(normalizeTags(["Node", "node", " CSS "]), ["node", "css"]);
  assert.equal(slugify("One Adapter, Web Semantics"), "one-adapter-web-semantics");
});
