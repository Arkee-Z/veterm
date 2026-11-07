import test from "node:test";
import assert from "node:assert/strict";
import { normalizePath, getExtension, ensureMarkdownExtension, inferPageType, resolvePageType } from "../src/blog/store.js";

test("normalizes safe relative paths", () => {
  assert.equal(normalizePath("./posts/hello-world.md"), "posts/hello-world.md");
  assert.equal(normalizePath("posts//hello-world.md"), "posts/hello-world.md");
});

test("rejects traversal and absolute paths", () => {
  for (const value of ["../secret.md", "posts/../../secret.md", "/etc/passwd", "~/secret.md", "C:\\secret.md"]) {
    assert.throws(() => normalizePath(value), /invalid path/i);
  }
});

test("extension helpers", () => {
  assert.equal(getExtension("posts/a.md"), "md");
  assert.equal(ensureMarkdownExtension("notes"), "notes.md");
  assert.equal(ensureMarkdownExtension("notes.md"), "notes.md");
  assert.equal(inferPageType("projects/demo/index.html"), "html");
});

test("stored page type cannot override an HTML extension", () => {
  assert.equal(resolvePageType("projects/demo/index.html", "md", "<h1>Demo</h1>"), "html");
  assert.equal(resolvePageType("projects/demo/index.html", "link", "<h1>Demo</h1>"), "html");
  assert.equal(resolvePageType("projects/demo/index.md", "md", "# Demo"), "md");
  assert.equal(resolvePageType("projects/demo/index.md", "link", "https://example.com"), "link");
});
