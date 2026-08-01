import type { MacroSequence } from "./profile";

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
