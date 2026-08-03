import type { MacroSequence } from "./profile";

export type TickRange = { start: number; end: number };
export type TickClipboard = MacroSequence["steps"];

export function totalTicks(sequence: MacroSequence) { return sequence.steps.reduce((sum, step) => sum + step.frames, 0); }
function loopTick(sequence: MacroSequence) { return sequence.steps.slice(0, sequence.loopStart).reduce((sum, step) => sum + step.frames, 0); }
export function maskAtTick(sequence: MacroSequence, tick: number) {
  let cursor = 0;
  for (const step of sequence.steps) { if (tick < cursor + step.frames) return step.mask; cursor += step.frames; }
  return 0;
}
function stepAtTick(steps: MacroSequence["steps"], tick: number) {
  let cursor = 0;
  for (let index = 0; index < steps.length; index++) { if (tick < cursor + steps[index].frames) return index; cursor += steps[index].frames; }
  return Math.max(0, steps.length - 1);
}
function mergeSteps(steps: MacroSequence["steps"]) {
  const merged: MacroSequence["steps"] = [];
  for (const step of steps.filter((item) => item.frames > 0)) {
    const last = merged.at(-1);
    if (last && last.mask === step.mask && last.frames + step.frames <= 65535) last.frames += step.frames;
    else merged.push({ ...step });
  }
  return merged.length ? merged : [{ mask: 0, frames: 1 }];
}

function normalizedRange(sequence: MacroSequence, start: number, end: number): TickRange {
  const last = Math.max(0, totalTicks(sequence) - 1);
  return { start: Math.max(0, Math.min(last, Math.min(start, end))), end: Math.max(0, Math.min(last, Math.max(start, end))) };
}

function sliceTicks(sequence: MacroSequence, start: number, end: number) {
  const next: MacroSequence["steps"] = [];
  let cursor = 0;
  for (const step of sequence.steps) {
    const overlapStart = Math.max(start, cursor);
    const overlapEnd = Math.min(end, cursor + step.frames);
    if (overlapStart < overlapEnd) next.push({ mask: step.mask, frames: overlapEnd - overlapStart });
    cursor += step.frames;
  }
  return mergeSteps(next);
}

export function copyTickRange(sequence: MacroSequence, start: number, end: number): TickClipboard {
  const range = normalizedRange(sequence, start, end);
  return sliceTicks(sequence, range.start, range.end + 1).map((step) => ({ ...step }));
}

export function insertTickRange(sequence: MacroSequence, tick: number, insertion: TickClipboard) {
  const total = totalTicks(sequence);
  const at = Math.max(0, Math.min(total, tick));
  const inserted = insertion.map((step) => ({ ...step })).filter((step) => step.frames > 0);
  if (!inserted.length) return;
  const oldLoopTick = loopTick(sequence);
  const before = at ? sliceTicks(sequence, 0, at) : [];
  const after = at < total ? sliceTicks(sequence, at, total) : [];
  sequence.steps = mergeSteps([...before, ...inserted, ...after]);
  const insertedTicks = inserted.reduce((sum, step) => sum + step.frames, 0);
  sequence.loopStart = stepAtTick(sequence.steps, oldLoopTick + (at <= oldLoopTick ? insertedTicks : 0));
}

export function replaceTickRange(sequence: MacroSequence, start: number, end: number, replacement: TickClipboard) {
  const total = totalTicks(sequence);
  const range = normalizedRange(sequence, start, end);
  const oldLoopTick = loopTick(sequence);
  const before = range.start ? sliceTicks(sequence, 0, range.start) : [];
  const after = range.end + 1 < total ? sliceTicks(sequence, range.end + 1, total) : [];
  const inserted = replacement.map((step) => ({ ...step })).filter((step) => step.frames > 0);
  const removedTicks = range.end - range.start + 1;
  const insertedTicks = inserted.reduce((sum, step) => sum + step.frames, 0);
  sequence.steps = mergeSteps([...before, ...inserted, ...after]);
  const nextTotal = totalTicks(sequence);
  const nextLoopTick = oldLoopTick < range.start
    ? oldLoopTick
    : oldLoopTick > range.end
      ? oldLoopTick + insertedTicks - removedTicks
      : range.start;
  sequence.loopStart = stepAtTick(sequence.steps, Math.max(0, Math.min(nextTotal - 1, nextLoopTick)));
}
export function setTickMask(sequence: MacroSequence, tick: number, mask: number) {
  const oldLoopTick = loopTick(sequence);
  let cursor = 0;
  const next: MacroSequence["steps"] = [];
  for (const step of sequence.steps) {
    if (tick >= cursor && tick < cursor + step.frames) {
      const before = tick - cursor, after = step.frames - before - 1;
      if (before) next.push({ mask: step.mask, frames: before });
      next.push({ mask, frames: 1 });
      if (after) next.push({ mask: step.mask, frames: after });
    } else next.push({ ...step });
    cursor += step.frames;
  }
  sequence.steps = mergeSteps(next);
  sequence.loopStart = stepAtTick(sequence.steps, oldLoopTick);
}
export function insertTick(sequence: MacroSequence, tick: number) {
  const total = totalTicks(sequence), oldLoopTick = loopTick(sequence);
  const at = Math.max(0, Math.min(total, tick));
  if (at === total) sequence.steps = mergeSteps([...sequence.steps, { mask: 0, frames: 1 }]);
  else {
    let cursor = 0;
    const next: MacroSequence["steps"] = [];
    for (const step of sequence.steps) {
      if (at >= cursor && at < cursor + step.frames) {
        const before = at - cursor, after = step.frames - before;
        if (before) next.push({ mask: step.mask, frames: before });
        next.push({ mask: 0, frames: 1 });
        if (after) next.push({ mask: step.mask, frames: after });
      } else next.push({ ...step });
      cursor += step.frames;
    }
    sequence.steps = mergeSteps(next);
  }
  sequence.loopStart = stepAtTick(sequence.steps, oldLoopTick + (at <= oldLoopTick ? 1 : 0));
}
export function deleteTick(sequence: MacroSequence, tick: number) {
  const total = totalTicks(sequence);
  if (total <= 1) return;
  const oldLoopTick = loopTick(sequence);
  let cursor = 0;
  const next: MacroSequence["steps"] = [];
  for (const step of sequence.steps) {
    if (tick >= cursor && tick < cursor + step.frames) {
      const before = tick - cursor, after = step.frames - before - 1;
      if (before) next.push({ mask: step.mask, frames: before });
      if (after) next.push({ mask: step.mask, frames: after });
    } else next.push({ ...step });
    cursor += step.frames;
  }
  sequence.steps = mergeSteps(next);
  sequence.loopStart = stepAtTick(sequence.steps, Math.max(0, oldLoopTick - (tick < oldLoopTick ? 1 : 0)));
}
