import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders EASY ARCADE Macro Studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /EASY ARCADE Macro Studio/i);
  assert.match(html, /<h1>EASY ARCADE Macro Studio<\/h1>/);
  assert.match(html, />共有<\/button>/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("uses a local preview identity without exposing personal data", async () => {
  const response = await render("/api/auth/me");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true, localPreview: true });
});

test("renders help page", async () => {
  const response = await render("/help");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /用語と仕組み/);
  assert.match(html, /編集画面/);
  assert.match(html, /エディタへ戻る/);
});
