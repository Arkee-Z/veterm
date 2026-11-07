import test from "node:test";
import assert from "node:assert/strict";
import { normalizePath, getExtension, ensureMarkdownExtension } from "../src/blog/store.js";

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
});
