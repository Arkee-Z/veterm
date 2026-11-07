import test from "node:test";
import assert from "node:assert/strict";
import { isAppRoute } from "../src/server/router.js";

test("serves the app shell for client routes", () => {
  assert.equal(isAppRoute("/"), true);
  assert.equal(isAppRoute("/archive"), true);
  assert.equal(isAppRoute("/archive/node"), true);
  assert.equal(isAppRoute("/posts/hello-world"), true);
  assert.equal(isAppRoute("/projects/palette-lab"), true);
  assert.equal(isAppRoute("/projects/foo/index.html"), true);
  assert.equal(isAppRoute("/notes"), true);
});

test("keeps missing static assets as 404s", () => {
  assert.equal(isAppRoute("/js/missing.js"), false);
  assert.equal(isAppRoute("/css/missing.css"), false);
  assert.equal(isAppRoute("/favicon.ico"), false);
  assert.equal(isAppRoute("/missing.png"), false);
});
