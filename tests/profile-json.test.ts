import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileProfile, createDefaultProfile } from "../app/profile";
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
  assert.throws(() => compileProfile(parsed), /8KB/);
});

test("published JSON Schema is valid JSON", async () => {
  const schema = JSON.parse(await readFile(new URL("../public/easy-arcade-profile.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.$id, "https://studio.easy-arcade.net/easy-arcade-profile.schema.json");
  assert.equal(schema.properties.format.const, "easy-arcade-profile");
});
