import {
  LOGICAL_BUTTONS, OUTPUTS, OutputTransform, Profile, ProfileMetadata,
  ProfileVerification, RapidFireOverride, RapidTriggerType, validateProfile,
} from "./profile";

type LogicalButton = typeof LOGICAL_BUTTONS[number];
type Output = typeof OUTPUTS[number];
type JsonObject = Record<string, unknown>;

export type EasyArcadeProfileJson = {
  format: "easy-arcade-profile";
  schemaVersion: 1;
  name: string;
  description: string;
  frameStep: number;
  mappings: Record<LogicalButton, Output[]>;
  rapidFire: Record<LogicalButton, RapidFireOverride>;
  macroSets: { id: number; name: string }[];
  sequences: { id: number; name: string; loopStart: number; steps: { outputs: Output[]; ticks: number }[] }[];
  bindings: { logicalButton: LogicalButton; sequenceId: number; setId: number; loop: boolean; cancelOnRelease: boolean; transform: OutputTransform }[];
  selectors: {
    id: number; name: string; incrementButton: LogicalButton; decrementButton: LogicalButton;
    minimum: number; maximum: number; initial: number; wrap: boolean; neutralFrames: number;
    states: { value: number; name: string; outputs: Output[] }[];
  }[];
  metadata?: ProfileMetadata;
};

export class ProfileJsonError extends Error {
  readonly englishMessage: string;

  constructor(japaneseMessage: string, englishMessage: string) {
    super(japaneseMessage);
    this.name = "ProfileJsonError";
    this.englishMessage = englishMessage;
  }

  localizedMessage(locale: "ja" | "en") { return locale === "ja" ? this.message : this.englishMessage; }
}

function fail(path: string, ja: string, en: string): never {
  throw new ProfileJsonError(`${path}: ${ja}`, `${path}: ${en}`);
}

function objectAt(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "objectである必要があります", "must be an object");
  return value as JsonObject;
}

function exactObject(value: unknown, path: string, allowed: readonly string[], required: readonly string[] = allowed): JsonObject {
  const object = objectAt(value, path);
  for (const key of Object.keys(object)) if (!allowed.includes(key)) fail(`${path}.${key}`, "未知のフィールドです", "is an unknown field");
  for (const key of required) if (!Object.hasOwn(object, key)) fail(`${path}.${key}`, "必須フィールドです", "is required");
  return object;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "文字列である必要があります", "must be a string");
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "trueまたはfalseである必要があります", "must be true or false");
  return value;
}

function integerAt(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    fail(path, `${minimum}〜${maximum}の整数である必要があります`, `must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "arrayである必要があります", "must be an array");
  return value;
}

function enumAt<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail(path, `${values.join("、")}のいずれかである必要があります`, `must be one of ${values.join(", ")}`);
  return value as T;
}

function logicalButtonAt(value: unknown, path: string): LogicalButton { return enumAt(value, path, LOGICAL_BUTTONS); }

function outputListAt(value: unknown, path: string): Output[] {
  const outputs = arrayAt(value, path).map((output, index) => enumAt(output, `${path}[${index}]`, OUTPUTS));
  if (new Set(outputs).size !== outputs.length) fail(path, "同じ出力を重複して指定できません", "must not contain duplicate outputs");
  return OUTPUTS.filter((output) => outputs.includes(output));
}

function maskFor(outputs: readonly Output[]): number {
  return outputs.reduce((mask, output) => mask | (1 << OUTPUTS.indexOf(output)), 0);
}

function outputsFor(mask: number): Output[] { return OUTPUTS.filter((_, index) => mask & (1 << index)); }

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonObject).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function metadataAt(value: unknown, path: string): ProfileMetadata {
  const metadata = objectAt(value, path);
  if (Object.hasOwn(metadata, "generator")) stringAt(metadata.generator, `${path}.generator`);
  if (Object.hasOwn(metadata, "sources")) arrayAt(metadata.sources, `${path}.sources`).forEach((source, index) => stringAt(source, `${path}.sources[${index}]`));
  if (Object.hasOwn(metadata, "verification")) enumAt(metadata.verification, `${path}.verification`, ["unverified", "editor-validated", "emulator-tested", "hardware-tested"] as const satisfies readonly ProfileVerification[]);
  return stableValue(metadata) as ProfileMetadata;
}

export function parseProfileJsonText(text: string): Profile {
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new ProfileJsonError("JSONの構文が不正です", "The JSON syntax is invalid"); }
  return parseProfileJson(parsed);
}

export function parseProfileJson(value: unknown): Profile {
  const fields = ["format", "schemaVersion", "name", "description", "frameStep", "mappings", "rapidFire", "macroSets", "sequences", "bindings", "selectors", "metadata"] as const;
  const root = exactObject(value, "$", fields, fields.filter((field) => field !== "metadata"));
  if (root.format !== "easy-arcade-profile") fail("$.format", "easy-arcade-profileである必要があります", "must be easy-arcade-profile");
  if (root.schemaVersion !== 1) fail("$.schemaVersion", "未対応のProfile JSONバージョンです", "is an unsupported Profile JSON version");

  const mappingObject = exactObject(root.mappings, "$.mappings", LOGICAL_BUTTONS);
  const mappings = LOGICAL_BUTTONS.map((button) => maskFor(outputListAt(mappingObject[button], `$.mappings.${button}`)));

  const rapidObject = exactObject(root.rapidFire, "$.rapidFire", LOGICAL_BUTTONS);
  const triggerTypes = ["disabled", "sync", "front", "back"] as const satisfies readonly RapidTriggerType[];
  const rapidFire = LOGICAL_BUTTONS.map((button): RapidFireOverride => {
    const item = exactObject(rapidObject[button], `$.rapidFire.${button}`, ["override", "triggerType", "divisor"]);
    return {
      override: booleanAt(item.override, `$.rapidFire.${button}.override`),
      triggerType: enumAt(item.triggerType, `$.rapidFire.${button}.triggerType`, triggerTypes),
      divisor: integerAt(item.divisor, `$.rapidFire.${button}.divisor`, 2, 60),
    };
  });

  const macroSets = arrayAt(root.macroSets, "$.macroSets");
  if (macroSets.length < 1 || macroSets.length > 16) fail("$.macroSets", "1〜16件である必要があります", "must contain 1 to 16 items");
  const macroSetNames = macroSets.map((value, index) => {
    const item = exactObject(value, `$.macroSets[${index}]`, ["id", "name"]);
    if (item.id !== index) fail(`$.macroSets[${index}].id`, `${index}である必要があります`, `must be ${index}`);
    return stringAt(item.name, `$.macroSets[${index}].name`);
  });

  const sequenceValues = arrayAt(root.sequences, "$.sequences");
  if (sequenceValues.length > 64) fail("$.sequences", "64件以下である必要があります", "must contain no more than 64 items");
  const sequenceIds = new Set<number>();
  const sequences = sequenceValues.map((value, index) => {
    const path = `$.sequences[${index}]`;
    const item = exactObject(value, path, ["id", "name", "loopStart", "steps"]);
    const id = integerAt(item.id, `${path}.id`, 0, 254);
    if (sequenceIds.has(id)) fail(`${path}.id`, "重複しています", "is duplicated");
    sequenceIds.add(id);
    const stepValues = arrayAt(item.steps, `${path}.steps`);
    if (stepValues.length < 1 || stepValues.length > 255) fail(`${path}.steps`, "1〜255件である必要があります", "must contain 1 to 255 items");
    const steps = stepValues.map((stepValue, stepIndex) => {
      const stepPath = `${path}.steps[${stepIndex}]`;
      const step = exactObject(stepValue, stepPath, ["outputs", "ticks"]);
      return { mask: maskFor(outputListAt(step.outputs, `${stepPath}.outputs`)), frames: integerAt(step.ticks, `${stepPath}.ticks`, 1, 65535) };
    });
    return { id, name: stringAt(item.name, `${path}.name`), loopStart: integerAt(item.loopStart, `${path}.loopStart`, 0, steps.length - 1), steps };
  });

  const bindingValues = arrayAt(root.bindings, "$.bindings");
  if (bindingValues.length > 256) fail("$.bindings", "256件以下である必要があります", "must contain no more than 256 items");
  const sequenceBindings = bindingValues.map((value, index) => {
    const path = `$.bindings[${index}]`;
    const item = exactObject(value, path, ["logicalButton", "sequenceId", "setId", "loop", "cancelOnRelease", "transform"]);
    const logicalButton = logicalButtonAt(item.logicalButton, `${path}.logicalButton`);
    return {
      logicalId: LOGICAL_BUTTONS.indexOf(logicalButton),
      sequenceId: integerAt(item.sequenceId, `${path}.sequenceId`, 0, 254),
      setId: integerAt(item.setId, `${path}.setId`, 0, macroSetNames.length - 1),
      loop: booleanAt(item.loop, `${path}.loop`),
      cancelOnRelease: booleanAt(item.cancelOnRelease, `${path}.cancelOnRelease`),
      transform: enumAt(item.transform, `${path}.transform`, ["none", "flipHorizontal", "flipVertical", "flipBoth"] as const),
    };
  });

  const selectorValues = arrayAt(root.selectors, "$.selectors");
  if (selectorValues.length > 8) fail("$.selectors", "8件以下である必要があります", "must contain no more than 8 items");
  const selectorIds = new Set<number>();
  const selectors = selectorValues.map((value, index) => {
    const path = `$.selectors[${index}]`;
    const item = exactObject(value, path, ["id", "name", "incrementButton", "decrementButton", "minimum", "maximum", "initial", "wrap", "neutralFrames", "states"]);
    const id = integerAt(item.id, `${path}.id`, 0, 255);
    if (selectorIds.has(id)) fail(`${path}.id`, "重複しています", "is duplicated");
    selectorIds.add(id);
    const minimum = integerAt(item.minimum, `${path}.minimum`, 0, 255);
    const maximum = integerAt(item.maximum, `${path}.maximum`, minimum, 255);
    const stateValues = arrayAt(item.states, `${path}.states`);
    if (stateValues.length !== maximum - minimum + 1 || stateValues.length > 64) fail(`${path}.states`, "状態範囲と件数が一致しません", "does not match the state range");
    const states = stateValues.map((stateValue, stateIndex) => {
      const statePath = `${path}.states[${stateIndex}]`;
      const state = exactObject(stateValue, statePath, ["value", "name", "outputs"]);
      const expectedValue = minimum + stateIndex;
      if (state.value !== expectedValue) fail(`${statePath}.value`, `${expectedValue}である必要があります`, `must be ${expectedValue}`);
      return { name: stringAt(state.name, `${statePath}.name`), mask: maskFor(outputListAt(state.outputs, `${statePath}.outputs`)) };
    });
    const increment = logicalButtonAt(item.incrementButton, `${path}.incrementButton`);
    const decrement = logicalButtonAt(item.decrementButton, `${path}.decrementButton`);
    return {
      id, name: stringAt(item.name, `${path}.name`), increment: LOGICAL_BUTTONS.indexOf(increment), decrement: LOGICAL_BUTTONS.indexOf(decrement),
      min: minimum, max: maximum, initial: integerAt(item.initial, `${path}.initial`, minimum, maximum), wrap: booleanAt(item.wrap, `${path}.wrap`),
      neutralFrames: integerAt(item.neutralFrames, `${path}.neutralFrames`, 0, 255), outputs: states.map((state) => state.mask), stateNames: states.map((state) => state.name),
    };
  });

  const profile: Profile = {
    schemaVersion: 1,
    name: stringAt(root.name, "$.name"),
    description: stringAt(root.description, "$.description"),
    frameStep: integerAt(root.frameStep, "$.frameStep", 1, 255),
    mappings, rapidFire, sequenceBindings, sequences, macroSets: { names: macroSetNames }, selectors,
    ...(Object.hasOwn(root, "metadata") ? { metadata: metadataAt(root.metadata, "$.metadata") } : {}),
  };
  const errors = validateProfile(profile);
  if (errors.length) throw new ProfileJsonError(errors[0], errors[0]);
  return profile;
}

export function toProfileJson(profile: Profile): EasyArcadeProfileJson {
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(errors[0]);
  const mappings = Object.fromEntries(LOGICAL_BUTTONS.map((button, index) => [button, outputsFor(profile.mappings[index])])) as Record<LogicalButton, Output[]>;
  const rapidFire = Object.fromEntries(LOGICAL_BUTTONS.map((button, index) => [button, { ...profile.rapidFire[index] }])) as Record<LogicalButton, RapidFireOverride>;
  return {
    format: "easy-arcade-profile",
    schemaVersion: 1,
    name: profile.name,
    description: profile.description,
    frameStep: profile.frameStep,
    mappings,
    rapidFire,
    macroSets: profile.macroSets.names.map((name, id) => ({ id, name })),
    sequences: [...profile.sequences].sort((a, b) => a.id - b.id).map((sequence) => ({
      id: sequence.id, name: sequence.name, loopStart: sequence.loopStart,
      steps: sequence.steps.map((step) => ({ outputs: outputsFor(step.mask), ticks: step.frames })),
    })),
    bindings: [...profile.sequenceBindings].sort((a, b) => a.logicalId - b.logicalId || a.sequenceId - b.sequenceId || a.setId - b.setId).map((binding) => ({
      logicalButton: LOGICAL_BUTTONS[binding.logicalId], sequenceId: binding.sequenceId, setId: binding.setId,
      loop: binding.loop, cancelOnRelease: binding.cancelOnRelease, transform: binding.transform,
    })),
    selectors: [...profile.selectors].sort((a, b) => a.id - b.id).map((selector) => ({
      id: selector.id, name: selector.name, incrementButton: LOGICAL_BUTTONS[selector.increment], decrementButton: LOGICAL_BUTTONS[selector.decrement],
      minimum: selector.min, maximum: selector.max, initial: selector.initial, wrap: selector.wrap, neutralFrames: selector.neutralFrames,
      states: selector.outputs.map((mask, index) => ({ value: selector.min + index, name: selector.stateNames[index], outputs: outputsFor(mask) })),
    })),
    ...(profile.metadata ? { metadata: stableValue(profile.metadata) as ProfileMetadata } : {}),
  };
}

export function serializeProfileJson(profile: Profile): string {
  return `${JSON.stringify(toProfileJson(profile), null, 2)}\n`;
}
