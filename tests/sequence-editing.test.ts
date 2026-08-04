import assert from "node:assert/strict";
import test from "node:test";
import type { MacroSequence } from "../app/profile";
import { copyTickRange, insertTickRange, maskAtTick, replaceTickRange, totalTicks } from "../app/sequenceEditing";

function sequence(steps: MacroSequence["steps"], loopStart = 0): MacroSequence {
  return { id: 1, name: "Test", loopStart, composition: "or", suppressionMask: 0, steps };
}

function masks(value: MacroSequence) {
  return Array.from({ length: totalTicks(value) }, (_, tick) => maskAtTick(value, tick));
}

test("copies an inclusive tick range without expanding compressed steps", () => {
  const source = sequence([{ mask: 1, frames: 3 }, { mask: 2, frames: 2 }, { mask: 4, frames: 3 }]);
  assert.deepEqual(copyTickRange(source, 1, 5), [{ mask: 1, frames: 2 }, { mask: 2, frames: 2 }, { mask: 4, frames: 1 }]);
});

test("replaces a range and keeps neighboring runs compressed", () => {
  const target = sequence([{ mask: 1, frames: 3 }, { mask: 2, frames: 2 }, { mask: 1, frames: 2 }]);
  replaceTickRange(target, 2, 4, [{ mask: 1, frames: 2 }, { mask: 4, frames: 1 }]);
  assert.deepEqual(target.steps, [{ mask: 1, frames: 4 }, { mask: 4, frames: 1 }, { mask: 1, frames: 2 }]);
  assert.deepEqual(masks(target), [1, 1, 1, 1, 4, 1, 1]);
});

test("pasting inserts ticks without replacing the selection", () => {
  const target = sequence([{ mask: 1, frames: 2 }, { mask: 2, frames: 2 }], 1);
  insertTickRange(target, 1, [{ mask: 4, frames: 2 }]);
  assert.deepEqual(masks(target), [1, 4, 4, 1, 2, 2]);
  assert.equal(target.loopStart, 3);
});

test("deleting the whole range leaves one neutral tick", () => {
  const target = sequence([{ mask: 1, frames: 2 }]);
  replaceTickRange(target, 0, 1, []);
  assert.deepEqual(target.steps, [{ mask: 0, frames: 1 }]);
});

test("loop start follows edits before and across the loop point", () => {
  const shifted = sequence([{ mask: 1, frames: 2 }, { mask: 2, frames: 2 }, { mask: 4, frames: 2 }], 2);
  replaceTickRange(shifted, 0, 0, [{ mask: 8, frames: 3 }]);
  assert.equal(shifted.loopStart, 3);

  const covered = sequence([{ mask: 1, frames: 2 }, { mask: 2, frames: 2 }, { mask: 4, frames: 2 }], 1);
  replaceTickRange(covered, 1, 4, [{ mask: 8, frames: 1 }]);
  assert.equal(covered.loopStart, 1);
});
