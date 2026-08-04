import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { automaticSuppressionMask, compileProfile, createDefaultProfile, EDITOR_LOGICAL_BUTTONS, LOGICAL_BUTTONS, parseProfile } from "../app/profile";
import { parseProfileJsonText, ProfileJsonError, serializeProfileJson, toProfileJson } from "../app/profileJson";
import { uniqueDownloadFileName } from "../app/downloadName";

function sampleProfile() {
  const profile = createDefaultProfile();
  profile.name = "JSON Round Trip";
  profile.description = "Profile JSON test";
  profile.frameStep = 2;
  profile.macroSets.names = ["Ryu", "Ken"];
  profile.sequences = [{ id: 3, name: "Hadoken", loopStart: 0, composition: "autoLever", suppressionMask: 0, steps: [{ mask: (1 << 3), frames: 1 }, { mask: (1 << 3) | (1 << 5), frames: 2 }, { mask: (1 << 5) | (1 << 6), frames: 1 }] }];
  profile.sequences[0].suppressionMask = automaticSuppressionMask(profile.sequences[0]);
  profile.sequenceBindings = [{ logicalId: 12, sequenceId: 3, setId: 0, loop: false, loopSync: false, cancelOnRelease: false, transform: "none" }];
  profile.selectors = [{ id: 1, name: "GEAR", increment: 13, decrement: 14, min: 0, max: 1, initial: 0, wrap: true, neutralFrames: 1, occupancyMask: 1 << 6, outputs: [0, 1 << 6], stateNames: ["LOW", "HIGH"] }];
  profile.metadata = { generator: "test", sources: ["https://example.com/moves"], verification: "editor-validated", extra: { z: 1, a: 2 } };
  return profile;
}

function withoutMetadata<T extends { metadata?: unknown }>(value: T) {
  const { metadata: _metadata, ...rest } = value;
  void _metadata;
  return rest;
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

function asPrototype16Bit(bytes: Uint8Array) {
  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payload: number[] = [];
  for (let cursor = 16; cursor < bytes.length;) {
    const type = bytes[cursor], length = sourceView.getUint16(cursor + 2, true);
    const source = bytes.subarray(cursor + 4, cursor + 4 + length);
    const converted: number[] = [];
    if (type === 0x01) {
      for (let index = 0; index < 18; index++) converted.push(source[index * 3], source[index * 3 + 1]);
    } else if (type === 0x03) {
      converted.push(source[0]);
      let position = 1;
      for (let definition = 0; definition < source[0]; definition++) {
        const count = source[position + 1];
        converted.push(...source.subarray(position, position + 8)); position += 8;
        for (let step = 0; step < count; step++, position += 5) converted.push(source[position], source[position + 1], source[position + 3], source[position + 4]);
      }
    } else if (type === 0x04) {
      converted.push(source[0]);
      let position = 1;
      for (let selector = 0; selector < source[0]; selector++) {
        const count = source[position + 8];
        converted.push(...source.subarray(position, position + 10)); position += 13;
        for (let state = 0; state < count; state++, position += 3) converted.push(source[position], source[position + 1]);
      }
    } else if (type === 0x05) converted.push(...source.subarray(0, 54));
    else converted.push(...source);
    payload.push(type, 0, converted.length & 0xff, converted.length >>> 8, ...converted);
    cursor += 4 + length;
  }
  const prototype = new Uint8Array(16 + payload.length);
  prototype.set(bytes.subarray(0, 16)); prototype.set(payload, 16);
  const view = new DataView(prototype.buffer);
  view.setUint32(8, prototype.length, true);
  view.setUint32(12, crc32(prototype.subarray(16)), true);
  return prototype;
}

function asPreCompositionBinary(bytes: Uint8Array) {
  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payload: number[] = [];
  for (let cursor = 16; cursor < bytes.length;) {
    const type = bytes[cursor], length = sourceView.getUint16(cursor + 2, true);
    const source = bytes.subarray(cursor + 4, cursor + 4 + length);
    const converted: number[] = [];
    if (type === 0x02) {
      converted.push(source[0], source[1]);
      const count = source[0] | (source[1] << 8);
      for (let index = 0; index < count; index++) {
        const position = 2 + index * 4;
        converted.push(source[position], source[position + 1], source[position + 2], source[position + 3] & ~16);
      }
    } else if (type === 0x03) {
      converted.push(source[0]);
      let position = 1;
      for (let definition = 0; definition < source[0]; definition++) {
        const count = source[position + 1];
        converted.push(source[position], count, source[position + 2], 0); position += 8;
        converted.push(...source.subarray(position, position + count * 5)); position += count * 5;
      }
    } else if (type === 0x04) {
      converted.push(source[0]);
      let position = 1;
      for (let selector = 0; selector < source[0]; selector++) {
        const count = source[position + 8];
        converted.push(...source.subarray(position, position + 10)); position += 13;
        converted.push(...source.subarray(position, position + count * 3)); position += count * 3;
      }
    } else converted.push(...source);
    payload.push(type, 0, converted.length & 0xff, converted.length >>> 8, ...converted);
    cursor += 4 + length;
  }
  const legacy = new Uint8Array(16 + payload.length);
  legacy.set(bytes.subarray(0, 16)); legacy.set(payload, 16);
  const view = new DataView(legacy.buffer);
  view.setUint32(8, legacy.length, true);
  view.setUint32(12, crc32(legacy.subarray(16)), true);
  return legacy;
}

function asBindingCompositionBinary(bytes: Uint8Array) {
  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payload: number[] = [];
  let composition = 0, suppressionMask = 0;
  for (let cursor = 16; cursor < bytes.length;) {
    const type = bytes[cursor], length = sourceView.getUint16(cursor + 2, true);
    if (type === 0x03 && bytes[cursor + 4] > 0) {
      composition = bytes[cursor + 8];
      suppressionMask = bytes[cursor + 9] | (bytes[cursor + 10] << 8) | (bytes[cursor + 11] << 16);
      break;
    }
    cursor += 4 + length;
  }
  for (let cursor = 16; cursor < bytes.length;) {
    const type = bytes[cursor], length = sourceView.getUint16(cursor + 2, true);
    const source = bytes.subarray(cursor + 4, cursor + 4 + length);
    const converted: number[] = [];
    if (type === 0x03) {
      converted.push(source[0]);
      let position = 1;
      for (let definition = 0; definition < source[0]; definition++) {
        const count = source[position + 1];
        composition = source[position + 3];
        suppressionMask = source[position + 4] | (source[position + 5] << 8) | (source[position + 6] << 16);
        converted.push(source[position], count, source[position + 2], 0); position += 8;
        converted.push(...source.subarray(position, position + count * 5)); position += count * 5;
      }
    } else if (type === 0x02) {
      converted.push(source[0], source[1]);
      const count = source[0] | (source[1] << 8);
      for (let index = 0; index < count; index++) {
        const position = 2 + index * 4;
        converted.push(...source.subarray(position, position + 4), composition, suppressionMask & 0xff, (suppressionMask >>> 8) & 0xff, (suppressionMask >>> 16) & 0xff);
      }
    } else converted.push(...source);
    payload.push(type, 0, converted.length & 0xff, converted.length >>> 8, ...converted);
    cursor += 4 + length;
  }
  const legacy = new Uint8Array(16 + payload.length);
  legacy.set(bytes.subarray(0, 16)); legacy.set(payload, 16);
  const view = new DataView(legacy.buffer);
  view.setUint32(8, legacy.length, true);
  view.setUint32(12, crc32(legacy.subarray(16)), true);
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

test("legacy Profile JSON defaults to OR composition without occupancy", () => {
  const json = toProfileJson(sampleProfile());
  const sequence = json.sequences[0] as unknown as Record<string, unknown>;
  const binding = json.bindings[0] as unknown as Record<string, unknown>;
  binding.composition = sequence.composition; binding.suppressedOutputs = sequence.suppressedOutputs;
  delete sequence.composition; delete sequence.suppressedOutputs; delete binding.loopSync;
  delete (json.selectors[0] as unknown as Record<string, unknown>).occupiedOutputs;
  const parsed = parseProfileJsonText(JSON.stringify(json));
  assert.equal(parsed.sequences[0].composition, "autoLever");
  assert.equal(parsed.sequences[0].suppressionMask, automaticSuppressionMask(parsed.sequences[0]));
  assert.deepEqual(parsed.sequenceBindings[0], { logicalId: 12, sequenceId: 3, setId: 0, loop: false, loopSync: false, cancelOnRelease: false, transform: "none" });
  assert.equal(parsed.selectors[0].occupancyMask, 0);
});

test("Loop Sync and masks round-trip through the binary format", () => {
  const source = sampleProfile();
  source.sequenceBindings[0].loop = true;
  source.sequenceBindings[0].loopSync = true;
  source.sequences[0].composition = "custom";
  source.sequences[0].suppressionMask = (1 << 2) | (1 << 6);
  source.selectors[0].occupancyMask = (1 << 7) | (1 << 8);
  const bytes = compileProfile(source);
  assert.equal(bytes[5], 1);
  assert.deepEqual(parseProfile(bytes), withoutMetadata(source));
});

test("v1.0 export remains available for compatible profiles", () => {
  const source = sampleProfile();
  source.sequences[0].composition = "or";
  source.sequences[0].suppressionMask = 0;
  source.selectors[0].occupancyMask = 0;
  const bytes = compileProfile(source, "1.0");
  assert.equal(bytes[5], 0);
  const imported = withoutMetadata(source);
  imported.sequences[0].composition = "autoLever";
  imported.sequences[0].suppressionMask = automaticSuppressionMask(imported.sequences[0]);
  assert.deepEqual(parseProfile(bytes), imported);
});

test("v1.0 imports migrate every macro to automatic composition", () => {
  const source = sampleProfile();
  source.sequences[0].composition = "or";
  source.sequences[0].suppressionMask = 0;
  source.selectors[0].occupancyMask = 0;
  const imported = parseProfile(compileProfile(source, "1.0"));
  assert.equal(imported.sequences[0].composition, "autoLever");
  assert.equal(imported.sequences[0].suppressionMask, automaticSuppressionMask(imported.sequences[0]));
});

test("v1.0 export never drops new behavior silently", () => {
  const source = sampleProfile();
  assert.throws(() => compileProfile(source, "1.0"), /入力抑制/);
  source.sequences[0].composition = "or"; source.sequences[0].suppressionMask = 0; source.sequenceBindings[0].loop = true; source.sequenceBindings[0].loopSync = true;
  assert.throws(() => compileProfile(source, "1.0"), /ループ同期/);
  source.sequenceBindings[0].loopSync = false; source.selectors[0].occupancyMask = 1;
  assert.throws(() => compileProfile(source, "1.0"), /占有マスク/);
});

test("pre-composition binary records migrate safely", () => {
  const source = sampleProfile();
  const restored = parseProfile(asPreCompositionBinary(compileProfile(source)));
  const expected = withoutMetadata(source);
  expected.sequenceBindings[0] = { ...expected.sequenceBindings[0], loopSync: false };
  expected.sequences[0] = { ...expected.sequences[0], composition: "or", suppressionMask: 0 };
  expected.selectors[0].occupancyMask = 0;
  assert.deepEqual(restored, expected);
});

test("early v1.1 binding-level composition migrates to the sequence", () => {
  const source = sampleProfile();
  assert.deepEqual(parseProfile(asBindingCompositionBinary(compileProfile(source))), withoutMetadata(source));
});

test("Loop Sync requires a full sequence loop", () => {
  const source = sampleProfile();
  source.sequenceBindings[0].loopSync = true;
  assert.throws(() => compileProfile(source), /ループ同期/);
  source.sequenceBindings[0].loop = true;
  source.sequences[0].loopStart = 1;
  assert.throws(() => compileProfile(source), /ループ同期/);
});

test("Profile JSON uses named buttons and outputs", () => {
  const json = toProfileJson(sampleProfile());
  assert.deepEqual(json.mappings.A, ["A"]);
  assert.equal(json.bindings[0].logicalButton, "G");
  assert.deepEqual(json.sequences[0].steps[1].outputs, ["DOWN", "RIGHT"]);
  assert.deepEqual(json.selectors[0].states[1], { value: 1, name: "HIGH", outputs: ["A"] });
});

test("the editor exposes 16 logical buttons while the format reserves 32", () => {
  assert.equal(EDITOR_LOGICAL_BUTTONS.length, 16);
  assert.equal(EDITOR_LOGICAL_BUTTONS.at(-1), "J");
  assert.equal(LOGICAL_BUTTONS.length, 32);
  assert.equal(LOGICAL_BUTTONS.at(-1), "Z");
  assert.equal(createDefaultProfile().mappings.length, 32);
});

test("fallback downloads use unique, recognizable file names", () => {
  const now = new Date(2026, 7, 2, 19, 45, 6, 7);
  assert.equal(uniqueDownloadFileName("My Profile.eamacro", now), "My Profile-20260802-194506-007.eamacro");
  assert.equal(uniqueDownloadFileName("My Profile.eamacro.json", now), "My Profile-20260802-194506-007.eamacro.json");
});

test("Profile JSON pads omitted reserved logical buttons", () => {
  const json = toProfileJson(sampleProfile());
  for (const button of LOGICAL_BUTTONS.slice(EDITOR_LOGICAL_BUTTONS.length)) {
    delete json.mappings[button];
    delete json.rapidFire[button];
  }
  const parsed = parseProfileJsonText(JSON.stringify(json));
  assert.equal(parsed.mappings.length, 32);
  assert.ok(parsed.mappings.slice(16).every((mask) => mask === 0));
  assert.ok(parsed.rapidFire.slice(16).every((rapid) => !rapid.override));
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

test("2P outputs round-trip through Profile JSON and 24-bit .eamacro masks", () => {
  const source = sampleProfile();
  source.twoPlayerOutputs = true;
  source.mappings[12] = (1 << 6) | (1 << 18);
  source.sequences[0].steps[0].mask = (1 << 3) | (1 << 4) | (1 << 6) | (1 << 17) | (1 << 18);
  source.sequences[0].suppressionMask = automaticSuppressionMask(source.sequences[0]);
  source.selectors[0].outputs[1] = (1 << 6) | (1 << 18);

  const json = serializeProfileJson(source);
  assert.match(json, /"twoPlayerOutputs": true/);
  assert.match(json, /"2P_A"/);
  assert.deepEqual(parseProfileJsonText(json), source);

  const bytes = compileProfile(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let directLength = 0, settingsFlags = 0;
  for (let cursor = 16; cursor < bytes.length;) {
    const type = bytes[cursor], length = view.getUint16(cursor + 2, true);
    if (type === 0x01) directLength = length;
    if (type === 0x07) settingsFlags = bytes[cursor + 5];
    cursor += 4 + length;
  }
  assert.equal(directLength, 96);
  assert.equal(settingsFlags, 1);
  assert.deepEqual(parseProfile(bytes), withoutMetadata(source));
});

test("prototype 16-bit output masks remain importable", () => {
  const source = sampleProfile();
  const restored = parseProfile(asPrototype16Bit(compileProfile(source)));
  const expected = withoutMetadata(source);
  expected.selectors[0].occupancyMask = 0;
  assert.deepEqual(restored, expected);
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
  assert.equal(schema.properties.twoPlayerOutputs.default, false);
  assert.ok(schema.$defs.output.enum.includes("2P_A"));
});
