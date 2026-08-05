import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/", extraEnv = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    ...extraEnv,
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders EASY ARCADE Macro Studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /EASY ARCADE Macro Studio/i);
  assert.match(html, /<h1>EASY ARCADE Macro Studio<\/h1>/);
  assert.match(html, />共有<\/button>/);
  assert.match(html, />English<\/button>/);
  assert.match(html, /旧形式で書き出す/);
  assert.doesNotMatch(html, /設定対象/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("returns D1 blob arrays as binary profile files", async () => {
  const fileData = [0x41, 0x4d, 0x41, 0x50, 1, 2, 3, 4];
  const statement = {
    bind() { return this; },
    async first() { return { profile_name: "Test Profile", file_data: fileData }; },
  };
  const response = await render("/api/shared-profiles/11111111-1111-1111-1111-111111111111/file", {
    DB: { prepare() { return statement; } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(fileData.length));
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], fileData);
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
  assert.match(html, /<h2>共有<\/h2>/);
  assert.match(html, /<h2>ループ同期<\/h2>/);
  assert.match(html, /位相2で初めてボタンを押した場合/);
  assert.match(html, /<h2>Profile JSON<\/h2>/);
  assert.match(html, /仕様と制限/);
  assert.match(html, /8192 bytes/);
  assert.match(html, /https:\/\/studio\.easy-arcade\.net\/easy-arcade-profile\.schema\.json/);
  assert.match(html, /閲覧とダウンロードにはログインが不要です/);
  assert.match(html, /エディタへ戻る/);
});
