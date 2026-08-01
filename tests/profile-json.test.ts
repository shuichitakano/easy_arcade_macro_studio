import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileProfile, createDefaultProfile, parseProfile } from "../app/profile";
import { parseProfileJsonText, ProfileJsonError, serializeProfileJson, toProfileJson } from "../app/profileJson";

function sampleProfile() {
  const profile = createDefaultProfile();
  profile.name = "JSON Round Trip";
  profile.description = "Profile JSON test";
  profile.frameStep = 2;
  profile.macroSets.names = ["Ryu", "Ken"];
  profile.sequences = [{ id: 3, name: "Hadoken", loopStart: 0, steps: [{ mask: (1 << 3), frames: 1 }, { mask: (1 << 3) | (1 << 5), frames: 2 }, { mask: (1 << 5) | (1 << 6), frames: 1 }] }];
  profile.sequenceBindings = [{ logicalId: 12, sequenceId: 3, setId: 0, loop: false, cancelOnRelease: false, transform: "none" }];
  profile.selectors = [{ id: 1, name: "GEAR", increment: 13, decrement: 14, min: 0, max: 1, initial: 0, wrap: true, neutralFrames: 1, outputs: [0, 1 << 6], stateNames: ["LOW", "HIGH"] }];
  profile.metadata = { generator: "test", sources: ["https://example.com/moves"], verification: "editor-validated", extra: { z: 1, a: 2 } };
  return profile;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function withLegacyJsonMetadata(bytes: Uint8Array, metadata: object) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payload: number[] = [];
  for (let cursor = 16; cursor < bytes.length;) {
    const length = view.getUint16(cursor + 2, true);
    if (bytes[cursor] !== 0x08) payload.push(...bytes.subarray(cursor, cursor + 4 + length));
    cursor += 4 + length;
  }
  const encoded = new TextEncoder().encode(JSON.stringify(metadata));
  payload.push(0x7f, 0, encoded.length & 0xff, encoded.length >>> 8, ...encoded);
  const legacy = new Uint8Array(16 + payload.length);
  legacy.set(bytes.subarray(0, 16));
  legacy.set(payload, 16);
  const legacyView = new DataView(legacy.buffer);
  legacyView.setUint32(8, legacy.length, true);
  legacyView.setUint32(12, crc32(legacy.subarray(16)), true);
  return legacy;
}

test("Profile JSON round-trips every executable setting", () => {
  const source = sampleProfile();
  const json = serializeProfileJson(source);
  const parsed = parseProfileJsonText(json);
  assert.deepEqual(parsed, source);
  assert.deepEqual(compileProfile(parsed), compileProfile(source));
  assert.equal(serializeProfileJson(parsed), json);
});

test("Profile JSON uses named buttons and outputs", () => {
  const json = toProfileJson(sampleProfile());
  assert.deepEqual(json.mappings.A, ["A"]);
  assert.equal(json.bindings[0].logicalButton, "G");
  assert.deepEqual(json.sequences[0].steps[1].outputs, ["DOWN", "RIGHT"]);
  assert.deepEqual(json.selectors[0].states[1], { value: 1, name: "HIGH", outputs: ["A"] });
});

test("Profile JSON rejects unknown executable fields", () => {
  const json = toProfileJson(sampleProfile()) as unknown as Record<string, unknown>;
  json.aiRecipe = true;
  assert.throws(() => parseProfileJsonText(JSON.stringify(json)), (error) => error instanceof ProfileJsonError && /未知のフィールド/.test(error.message));
});

test("Profile JSON itself is not limited to 8 KB", () => {
  const json = toProfileJson(sampleProfile());
  json.metadata = { notes: "x".repeat(9000) };
  const parsed = parseProfileJsonText(JSON.stringify(json));
  assert.equal(parsed.metadata?.notes, "x".repeat(9000));
  assert.ok(compileProfile(parsed).length < 8192);
});

test(".eamacro stores names as compact binary metadata", () => {
  const source = sampleProfile();
  source.name = "日本語プロファイル";
  source.sequences[0].name = "波動拳";
  source.selectors[0].stateNames = ["低速", "高速"];
  const bytes = compileProfile(source);
  const sectionTypes: number[] = [];
  for (let cursor = 16; cursor < bytes.length;) {
    sectionTypes.push(bytes[cursor]);
    cursor += 4 + new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(cursor + 2, true);
  }
  assert.ok(sectionTypes.includes(0x08));
  assert.ok(!sectionTypes.includes(0x7f));
  assert.ok(!new TextDecoder().decode(bytes).includes("sequenceNames"));

  const restored = parseProfile(bytes);
  const { metadata: _sourceMetadata, ...sourceWithoutMetadata } = source;
  const { metadata: _restoredMetadata, ...restoredWithoutMetadata } = restored;
  void _sourceMetadata; void _restoredMetadata;
  assert.deepEqual(restoredWithoutMetadata, sourceWithoutMetadata);
  assert.equal(restored.metadata, undefined);
});

test("legacy prototype JSON metadata remains importable", () => {
  const source = sampleProfile();
  const legacy = withLegacyJsonMetadata(compileProfile(source), {
    name: "Legacy Profile",
    description: "migration only",
    sequenceNames: { 3: "Legacy Macro" },
    macroSetNames: ["Legacy Set 0", "Legacy Set 1"],
    selectorNames: { 1: "Legacy Selector" },
    selectorStateNames: { 1: ["LOW", "HIGH"] },
    generator: "prototype",
  });
  const restored = parseProfile(legacy);
  assert.equal(restored.name, "Legacy Profile");
  assert.equal(restored.sequences[0].name, "Legacy Macro");
  assert.deepEqual(restored.macroSets.names, ["Legacy Set 0", "Legacy Set 1"]);
  assert.equal(restored.selectors[0].name, "Legacy Selector");
  assert.deepEqual(restored.metadata, { generator: "prototype" });
});

test("published JSON Schema is valid JSON", async () => {
  const schema = JSON.parse(await readFile(new URL("../public/easy-arcade-profile.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.$id, "https://studio.easy-arcade.net/easy-arcade-profile.schema.json");
  assert.equal(schema.properties.format.const, "easy-arcade-profile");
});
