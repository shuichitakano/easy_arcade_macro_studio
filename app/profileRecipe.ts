import { createDefaultProfile, LOGICAL_BUTTONS, OUTPUTS } from "./profile.ts";
import type { OutputTransform, Profile } from "./profile.ts";

export type OutputName = typeof OUTPUTS[number];
export type LogicalButtonName = typeof LOGICAL_BUTTONS[number];

export type ProfileRecipe = {
  name: string;
  description: string;
  frameStep?: number;
  macros: Array<{
    key: string;
    name: string;
    steps: Array<{ outputs: OutputName[]; frames: number }>;
    loopStart?: number;
  }>;
  sets: Array<{
    name: string;
    bindings: Array<{
      trigger: LogicalButtonName;
      macro: string;
      transform?: OutputTransform;
      loop?: boolean;
      cancelOnRelease?: boolean;
    }>;
  }>;
};

export function buildProfileFromRecipe(recipe: ProfileRecipe): Profile {
  const profile = createDefaultProfile();
  const macroIds = new Map<string, number>();
  recipe.macros.forEach((macro, index) => {
    if (macroIds.has(macro.key)) throw new Error(`Duplicate macro key: ${macro.key}`);
    macroIds.set(macro.key, index);
  });

  profile.name = recipe.name;
  profile.description = recipe.description;
  profile.frameStep = recipe.frameStep ?? 1;
  profile.sequences = recipe.macros.map((macro, id) => ({
    id,
    name: macro.name,
    loopStart: macro.loopStart ?? 0,
    steps: macro.steps.map((step) => ({
      mask: step.outputs.reduce((mask, output) => {
        const index = OUTPUTS.indexOf(output);
        if (index < 0) throw new Error(`Unknown output: ${output}`);
        return mask | (1 << index);
      }, 0),
      frames: step.frames,
    })),
  }));
  profile.macroSets.names = recipe.sets.map((set) => set.name);
  profile.sequenceBindings = recipe.sets.flatMap((set, setId) => set.bindings.map((binding) => {
    const logicalId = LOGICAL_BUTTONS.indexOf(binding.trigger);
    const sequenceId = macroIds.get(binding.macro);
    if (logicalId < 0) throw new Error(`Unknown logical button: ${binding.trigger}`);
    if (sequenceId === undefined) throw new Error(`Unknown macro key: ${binding.macro}`);
    return {
      logicalId,
      sequenceId,
      setId,
      loop: binding.loop ?? false,
      cancelOnRelease: binding.cancelOnRelease ?? false,
      transform: binding.transform ?? "none",
    };
  }));
  return profile;
}
