import assert from "node:assert/strict";
import test from "node:test";
import { compileProfile, parseProfile } from "../app/profile.ts";
import { createStreetFighter2ChampionEditionProfile } from "../samples/streetFighter2ChampionEdition.ts";

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
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("builds the Street Fighter II Champion Edition sample", () => {
  const profile = createStreetFighter2ChampionEditionProfile();
  const bytes = compileProfile(profile);
  const parsed = parseProfile(bytes);
  assert.equal(profile.macroSets.names.length, 12);
  assert.equal(profile.sequences.length, 37);
  assert.ok(bytes.length < 8192);
  assert.deepEqual(parsed.macroSets.names, profile.macroSets.names);
  assert.equal(parsed.sequenceBindings.length, profile.sequenceBindings.length);
  assert.ok(profile.sequenceBindings.some((binding) => binding.transform === "flipHorizontal"));
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
  assert.match(html, /閲覧とダウンロードにはログインが不要です/);
  assert.match(html, /エディタへ戻る/);
});
