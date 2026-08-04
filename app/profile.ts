export const EDITOR_LOGICAL_BUTTONS = [
  "COIN", "START", "UP", "DOWN", "LEFT", "RIGHT",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
] as const;

// The file format reserves 32 logical-button IDs. The regular editor exposes
// the first 16; the remaining IDs stay available for future hardware/editors.
export const LOGICAL_BUTTONS = [
  ...EDITOR_LOGICAL_BUTTONS,
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;

export const PLAYER_OUTPUTS = [
  "COIN", "START", "UP", "DOWN", "LEFT", "RIGHT", "A", "B", "C", "D", "E", "F",
] as const;

export const OUTPUTS = [
  ...PLAYER_OUTPUTS,
  "2P_COIN", "2P_START", "2P_UP", "2P_DOWN", "2P_LEFT", "2P_RIGHT", "2P_A", "2P_B", "2P_C", "2P_D", "2P_E", "2P_F",
] as const;

export const MAX_PROFILE_BYTES = 8192;
export const MAX_SEQUENCE_BINDINGS = 256;
export type BinaryProfileVersion = "1.0" | "1.1";

export type SequenceStep = { mask: number; frames: number };
export type MacroSequence = {
  id: number; name: string; loopStart: number; steps: SequenceStep[];
  composition: CompositionMode; suppressionMask: number;
};
export type OutputTransform = "none" | "flipHorizontal" | "flipVertical" | "flipBoth";
export type CompositionMode = "or" | "autoLever" | "custom";
export type SequenceBinding = {
  logicalId: number; sequenceId: number; setId: number;
  loop: boolean; loopSync: boolean; cancelOnRelease: boolean;
  transform: OutputTransform;
};
export type MacroSetConfig = { names: string[] };
export type RapidTriggerType = "disabled" | "sync" | "front" | "back";
export type RapidFireOverride = { override: boolean; triggerType: RapidTriggerType; divisor: number };
export type ProfileVerification = "unverified" | "editor-validated" | "emulator-tested" | "hardware-tested";
export type ProfileMetadata = Record<string, unknown> & {
  generator?: string;
  sources?: string[];
  verification?: ProfileVerification;
};
export type StateSelector = {
  id: number; name: string; increment: number; decrement: number;
  min: number; max: number; initial: number; wrap: boolean;
  neutralFrames: number; occupancyMask: number; outputs: number[]; stateNames: string[];
};
export type Profile = {
  schemaVersion: 1;
  name: string;
  description: string;
  frameStep: number;
  twoPlayerOutputs: boolean;
  mappings: number[];
  rapidFire: RapidFireOverride[];
  sequenceBindings: SequenceBinding[];
  sequences: MacroSequence[];
  macroSets: MacroSetConfig;
  selectors: StateSelector[];
  metadata?: ProfileMetadata;
};

export function localizeProfileMessage(message: string, locale: "ja" | "en") {
  if (locale === "ja") return message;
  const exact: Record<string, string> = {
    "基本フレームステップが不正です": "The base frame step is invalid",
    "2P出力設定が不正です": "The 2P output setting is invalid",
    "シーケンスは64件までです": "A profile can contain up to 64 sequences",
    "マクロセットは1〜16件必要です": "A profile must contain 1–16 macro sets",
    "ステートセレクタは8件までです": "A profile can contain up to 8 state selectors",
    "全シーケンスの合計は1024ステップまでです": "All sequences combined can contain up to 1,024 steps",
    "マクロ割り当ての論理ボタンが不正です": "A macro assignment has an invalid logical button",
    "マクロ割り当ての出力変換が不正です": "A macro assignment has an invalid output transform",
    "マクロの合成方式が不正です": "A macro has an invalid composition mode",
    "マクロの抑制マスクが不正です": "A macro has an invalid suppression mask",
    "OR合成の抑制マスクは0である必要があります": "An OR assignment must have an empty suppression mask",
    "自動合成の抑制マスクがシーケンスと一致しません": "An automatic assignment suppression mask does not match its sequence",
    "ループ同期には先頭からの保持中反復が必要です": "Loop Sync requires repeat-while-held playback starting at the first step",
    "ステートセレクタの占有マスクが重複しています": "State selector occupancy masks overlap",
    "v1.0ではマクロの入力抑制を使用できません": "Macro input suppression cannot be exported as v1.0",
    "v1.0ではループ同期を使用できません": "Loop Sync cannot be exported as v1.0",
    "v1.0ではステートセレクタの占有マスクを使用できません": "State selector occupancy masks cannot be exported as v1.0",
    "マクロ割り当てのSet IDが不正です": "A macro assignment has an invalid Set ID",
    "同じセット、論理ボタン、マクロの割り当てが重複しています": "A set contains a duplicate logical-button and macro assignment",
    "AMAPファイルではありません": "This is not an AMAP file",
    "ファイルが8KBを超えています": "The file is larger than 8 KB",
    "未対応のファイルバージョンです": "This file version is not supported",
    "ヘッダのサイズが不正です": "The header size is invalid",
    "CRC32が一致しません": "The CRC32 does not match",
    "セクションヘッダが途中で終了しています": "A section header is truncated",
    "セクションが不正です": "A section is invalid",
    "セクションが重複しています": "A section is duplicated",
    "必須セクションがありません": "A required section is missing",
    "Sequence Bindingの長さが不正です": "The Sequence Binding length is invalid",
    "Profile Settingsセクションが不正です": "The Profile Settings section is invalid",
    "Macro Setsセクションが不正です": "The Macro Sets section is invalid",
    "シーケンス定義が途中で終了しています": "A sequence definition is truncated",
    "ステップが途中で終了しています": "A step is truncated",
    "シーケンス定義に余剰データがあります": "A sequence definition contains extra data",
    "セレクタ定義が途中で終了しています": "A selector definition is truncated",
    "状態出力が途中で終了しています": "A state output is truncated",
    "セレクタ定義に余剰データがあります": "A selector definition contains extra data",
    "Rapid Fire Overridesの長さが不正です": "The Rapid Fire Overrides length is invalid",
    "Metadataセクションが不正です": "The Metadata section is invalid",
    "MetadataのUTF-8が不正です": "The Metadata contains invalid UTF-8",
  };
  if (exact[message]) return exact[message];
  const replacements: Array<[RegExp, string]> = [
    [/^直接マッピングは(\d+)件必要です$/, "Direct mapping requires $1 entries"],
    [/^連射設定は(\d+)件必要です$/, "Rapid-fire settings require $1 entries"],
    [/^マクロ割り当ては(\d+)件までです$/, "A profile can contain up to $1 macro assignments"],
    [/^ファイルが8KBを超えます（(\d+) bytes）$/, "The file is larger than 8 KB ($1 bytes)"],
    [/^(.+)の出力マスクが不正です$/, "$1 has an invalid output mask"],
    [/^(.+)の連射トリガタイプが不正です$/, "$1 has an invalid rapid-fire trigger type"],
    [/^(.+)の連射速度が不正です$/, "$1 has an invalid rapid-fire rate"],
    [/^シーケンスID (.+) が不正または重複しています$/, "Sequence ID $1 is invalid or duplicated"],
    [/^(.+): ステップ数が範囲外です$/, "$1: the step count is out of range"],
    [/^(.+): ループ開始位置が不正です$/, "$1: the loop start is invalid"],
    [/^(.+): ステップが不正です$/, "$1: a step is invalid"],
    [/^(.+)が未定義のシーケンスを参照しています$/, "$1 references an undefined sequence"],
    [/^セレクタID (.+) が重複しています$/, "Selector ID $1 is duplicated"],
    [/^(.+): 増加・減少ボタンが不正です$/, "$1: the increment or decrement button is invalid"],
    [/^(.+): 状態範囲と出力数が一致しません$/, "$1: the state range does not match the output count"],
    [/^(.+): ステート名と状態数が一致しません$/, "$1: the state-name count does not match the state count"],
    [/^(.+): 状態は64件までです$/, "$1: a selector can contain up to 64 states"],
    [/^(.+): 状態出力マスクが不正です$/, "$1: a state has an invalid output mask"],
    [/^(.+): 占有マスクが不正です$/, "$1: the occupancy mask is invalid"],
  ];
  for (const [pattern, replacement] of replacements) if (pattern.test(message)) return message.replace(pattern, replacement);
  return message;
}

function inheritedRapidFire(): RapidFireOverride[] {
  return LOGICAL_BUTTONS.map(() => ({ override: false, triggerType: "disabled", divisor: 2 }));
}

export function createDefaultProfile(): Profile {
  return {
    schemaVersion: 1,
    name: "My Arcade Profile",
    description: "",
    frameStep: 1,
    twoPlayerOutputs: false,
    mappings: LOGICAL_BUTTONS.map((_, i) => (i < PLAYER_OUTPUTS.length ? 1 << i : 0)),
    rapidFire: inheritedRapidFire(),
    sequenceBindings: [],
    sequences: [],
    macroSets: { names: ["Set 0"] },
    selectors: [],
  };
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(target: number[], value: number) { target.push(value & 0xff, (value >>> 8) & 0xff); }
function u24(target: number[], value: number) { target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff); }
function section(type: number, payload: number[]): number[] { return [type, 0, payload.length & 0xff, (payload.length >>> 8) & 0xff, ...payload]; }
function read16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function read24(data: Uint8Array, offset: number) { return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16); }
function transformFromFlags(flags: number): OutputTransform {
  return (flags & 12) === 12 ? "flipBoth" : flags & 4 ? "flipHorizontal" : flags & 8 ? "flipVertical" : "none";
}
function transformFlags(transform: OutputTransform): number {
  return transform === "flipBoth" ? 12 : transform === "flipHorizontal" ? 4 : transform === "flipVertical" ? 8 : 0;
}

const P1_LEVER_MASK = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5);
const P2_LEVER_MASK = P1_LEVER_MASK << 12;

export function automaticSuppressionMask(sequence: MacroSequence): number {
  const used = sequence.steps.reduce((mask, step) => mask | step.mask, 0);
  return (used & P1_LEVER_MASK ? P1_LEVER_MASK : 0) | (used & P2_LEVER_MASK ? P2_LEVER_MASK : 0);
}

function encodedString(value: string) { return Array.from(new TextEncoder().encode(value)); }
function appendEncodedString(target: number[], value: string) {
  const bytes = encodedString(value);
  u16(target, bytes.length);
  target.push(...bytes);
}

function compileMetadata(profile: Profile): number[] {
  const profileName = encodedString(profile.name);
  const description = encodedString(profile.description);
  const sequences = [...profile.sequences].sort((a, b) => a.id - b.id);
  const selectors = [...profile.selectors].sort((a, b) => a.id - b.id);
  const result = [1, 0];
  u16(result, profileName.length);
  u16(result, description.length);
  result.push(sequences.length, profile.macroSets.names.length, selectors.length, 0, ...profileName, ...description);
  sequences.forEach((sequence) => { result.push(sequence.id); appendEncodedString(result, sequence.name); });
  profile.macroSets.names.forEach((name) => appendEncodedString(result, name));
  selectors.forEach((selector) => {
    const name = encodedString(selector.name);
    result.push(selector.id); u16(result, name.length); result.push(selector.stateNames.length, ...name);
    selector.stateNames.forEach((stateName) => appendEncodedString(result, stateName));
  });
  return result;
}

function decodeMetadataString(data: Uint8Array, offset: number, length: number): string {
  if (offset + length > data.length) throw new Error("Metadataセクションが不正です");
  try { return new TextDecoder("utf-8", { fatal: true }).decode(data.subarray(offset, offset + length)); }
  catch { throw new Error("MetadataのUTF-8が不正です"); }
}

function parseMetadata(data: Uint8Array, sequences: MacroSequence[], macroSets: MacroSetConfig, selectors: StateSelector[]) {
  if (data.length < 10 || data[0] !== 1 || data[1] !== 0 || data[9] !== 0) throw new Error("Metadataセクションが不正です");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const profileNameLength = view.getUint16(2, true), descriptionLength = view.getUint16(4, true);
  const sequenceCount = data[6], setCount = data[7], selectorCount = data[8];
  if (sequenceCount !== sequences.length || setCount !== macroSets.names.length || selectorCount !== selectors.length) throw new Error("Metadataセクションが不正です");
  let cursor = 10;
  const name = decodeMetadataString(data, cursor, profileNameLength); cursor += profileNameLength;
  const description = decodeMetadataString(data, cursor, descriptionLength); cursor += descriptionLength;

  const sequenceById = new Map(sequences.map((sequence) => [sequence.id, sequence]));
  const seenSequenceIds = new Set<number>();
  for (let index = 0; index < sequenceCount; index++) {
    if (cursor + 3 > data.length) throw new Error("Metadataセクションが不正です");
    const id = data[cursor], length = view.getUint16(cursor + 1, true); cursor += 3;
    const sequence = sequenceById.get(id);
    if (!sequence || seenSequenceIds.has(id)) throw new Error("Metadataセクションが不正です");
    seenSequenceIds.add(id); sequence.name = decodeMetadataString(data, cursor, length); cursor += length;
  }

  for (let index = 0; index < setCount; index++) {
    if (cursor + 2 > data.length) throw new Error("Metadataセクションが不正です");
    const length = view.getUint16(cursor, true); cursor += 2;
    macroSets.names[index] = decodeMetadataString(data, cursor, length); cursor += length;
  }

  const selectorById = new Map(selectors.map((selector) => [selector.id, selector]));
  const seenSelectorIds = new Set<number>();
  for (let index = 0; index < selectorCount; index++) {
    if (cursor + 4 > data.length) throw new Error("Metadataセクションが不正です");
    const id = data[cursor], nameLength = view.getUint16(cursor + 1, true), stateCount = data[cursor + 3]; cursor += 4;
    const selector = selectorById.get(id);
    if (!selector || seenSelectorIds.has(id) || stateCount !== selector.outputs.length) throw new Error("Metadataセクションが不正です");
    seenSelectorIds.add(id); selector.name = decodeMetadataString(data, cursor, nameLength); cursor += nameLength;
    for (let stateIndex = 0; stateIndex < stateCount; stateIndex++) {
      if (cursor + 2 > data.length) throw new Error("Metadataセクションが不正です");
      const length = view.getUint16(cursor, true); cursor += 2;
      selector.stateNames[stateIndex] = decodeMetadataString(data, cursor, length); cursor += length;
    }
  }
  if (cursor !== data.length) throw new Error("Metadataセクションが不正です");
  return { name, description };
}

export function bindingsFor(profile: Profile, sequenceId: number) {
  return profile.sequenceBindings.filter((binding) => binding.sequenceId === sequenceId);
}

export function legacyExportIssues(profile: Profile): string[] {
  const issues: string[] = [];
  if (profile.sequences.some((sequence) => sequence.suppressionMask !== 0)) issues.push("v1.0ではマクロの入力抑制を使用できません");
  if (profile.sequenceBindings.some((binding) => binding.loopSync)) issues.push("v1.0ではループ同期を使用できません");
  if (profile.selectors.some((selector) => selector.occupancyMask !== 0)) issues.push("v1.0ではステートセレクタの占有マスクを使用できません");
  return issues;
}

export function validateProfile(profile: Profile): string[] {
  const errors: string[] = [];
  const outputMask = profile.twoPlayerOutputs ? 0xffffff : 0x0fff;
  if (typeof profile.twoPlayerOutputs !== "boolean") errors.push("2P出力設定が不正です");
  if (profile.mappings.length !== LOGICAL_BUTTONS.length) errors.push(`直接マッピングは${LOGICAL_BUTTONS.length}件必要です`);
  if (profile.rapidFire.length !== LOGICAL_BUTTONS.length) errors.push(`連射設定は${LOGICAL_BUTTONS.length}件必要です`);
  if (profile.sequenceBindings.length > MAX_SEQUENCE_BINDINGS) errors.push(`マクロ割り当ては${MAX_SEQUENCE_BINDINGS}件までです`);
  if (!Number.isInteger(profile.frameStep) || profile.frameStep < 1 || profile.frameStep > 255) errors.push("基本フレームステップが不正です");
  if (profile.sequences.length > 64) errors.push("シーケンスは64件までです");
  if (!profile.macroSets || profile.macroSets.names.length < 1 || profile.macroSets.names.length > 16) errors.push("マクロセットは1〜16件必要です");
  const macroSetCount = profile.macroSets?.names.length ?? 0;
  if (profile.selectors.length > 8) errors.push("ステートセレクタは8件までです");
  profile.mappings.forEach((mask, i) => { if (!Number.isInteger(mask) || mask < 0 || (mask & ~outputMask)) errors.push(`${LOGICAL_BUTTONS[i]}の出力マスクが不正です`); });
  profile.rapidFire.forEach((rapid, i) => {
    if (!(["disabled", "sync", "front", "back"] as RapidTriggerType[]).includes(rapid.triggerType)) errors.push(`${LOGICAL_BUTTONS[i]}の連射トリガタイプが不正です`);
    if (rapid.divisor < 2 || rapid.divisor > 60) errors.push(`${LOGICAL_BUTTONS[i]}の連射速度が不正です`);
  });

  const ids = new Set<number>();
  let totalSteps = 0;
  for (const seq of profile.sequences) {
    if (seq.id < 0 || seq.id > 254 || ids.has(seq.id)) errors.push(`シーケンスID ${seq.id} が不正または重複しています`);
    ids.add(seq.id);
    totalSteps += seq.steps.length;
    if (!seq.steps.length || seq.steps.length > 255) errors.push(`${seq.name}: ステップ数が範囲外です`);
    if (seq.loopStart < 0 || seq.loopStart >= seq.steps.length) errors.push(`${seq.name}: ループ開始位置が不正です`);
    if (seq.steps.some((step) => step.frames < 1 || step.frames > 65535 || !Number.isInteger(step.mask) || step.mask < 0 || !!(step.mask & ~outputMask))) errors.push(`${seq.name}: ステップが不正です`);
    if (!(seq.composition === "or" || seq.composition === "autoLever" || seq.composition === "custom")) errors.push("マクロの合成方式が不正です");
    if (!Number.isInteger(seq.suppressionMask) || seq.suppressionMask < 0 || (seq.suppressionMask & ~outputMask)) errors.push("マクロの抑制マスクが不正です");
    if (seq.composition === "or" && seq.suppressionMask !== 0) errors.push("OR合成の抑制マスクは0である必要があります");
    if (seq.composition === "autoLever" && seq.suppressionMask !== automaticSuppressionMask(seq)) errors.push("自動合成の抑制マスクがシーケンスと一致しません");
  }
  if (totalSteps > 1024) errors.push("全シーケンスの合計は1024ステップまでです");
  const bindingKeys = new Set<string>();
  for (const binding of profile.sequenceBindings) {
    const key = `${binding.setId}:${binding.logicalId}:${binding.sequenceId}`;
    const sequence = profile.sequences.find((item) => item.id === binding.sequenceId);
    if (binding.logicalId < 0 || binding.logicalId >= LOGICAL_BUTTONS.length) errors.push("マクロ割り当ての論理ボタンが不正です");
    if (!ids.has(binding.sequenceId)) errors.push(`${LOGICAL_BUTTONS[binding.logicalId] ?? "不明"}が未定義のシーケンスを参照しています`);
    if (!(binding.transform === "none" || binding.transform === "flipHorizontal" || binding.transform === "flipVertical" || binding.transform === "flipBoth")) errors.push("マクロ割り当ての出力変換が不正です");
    if (typeof binding.loopSync !== "boolean" || (binding.loopSync && (!binding.loop || sequence?.loopStart !== 0))) errors.push("ループ同期には先頭からの保持中反復が必要です");
    if (!Number.isInteger(binding.setId) || binding.setId < 0 || binding.setId >= macroSetCount) errors.push("マクロ割り当てのSet IDが不正です");
    if (bindingKeys.has(key)) errors.push("同じセット、論理ボタン、マクロの割り当てが重複しています");
    bindingKeys.add(key);
  }

  const selectorIds = new Set<number>();
  let occupiedOutputs = 0;
  for (const selector of profile.selectors) {
    if (selectorIds.has(selector.id)) errors.push(`セレクタID ${selector.id} が重複しています`);
    selectorIds.add(selector.id);
    if (selector.increment === selector.decrement || selector.increment < 0 || selector.increment >= LOGICAL_BUTTONS.length || selector.decrement < 0 || selector.decrement >= LOGICAL_BUTTONS.length) errors.push(`${selector.name}: 増加・減少ボタンが不正です`);
    if (selector.max < selector.min || selector.outputs.length !== selector.max - selector.min + 1 || selector.initial < selector.min || selector.initial > selector.max) errors.push(`${selector.name}: 状態範囲と出力数が一致しません`);
    if (!Array.isArray(selector.stateNames) || selector.stateNames.length !== selector.outputs.length || selector.stateNames.some((name) => typeof name !== "string")) errors.push(`${selector.name}: ステート名と状態数が一致しません`);
    if (selector.outputs.length > 64) errors.push(`${selector.name}: 状態は64件までです`);
    if (selector.outputs.some((mask) => !Number.isInteger(mask) || mask < 0 || (mask & ~outputMask))) errors.push(`${selector.name}: 状態出力マスクが不正です`);
    if (!Number.isInteger(selector.occupancyMask) || selector.occupancyMask < 0 || (selector.occupancyMask & ~outputMask)) errors.push(`${selector.name}: 占有マスクが不正です`);
    if (selector.occupancyMask & occupiedOutputs) errors.push("ステートセレクタの占有マスクが重複しています");
    occupiedOutputs |= selector.occupancyMask;
  }
  return errors;
}

export function compileProfile(profile: Profile, version: BinaryProfileVersion = "1.1"): Uint8Array {
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(errors[0]);
  if (version === "1.0") {
    const issues = legacyExportIssues(profile);
    if (issues.length) throw new Error(issues[0]);
  }

  const direct: number[] = [];
  profile.mappings.forEach((mask) => u24(direct, mask));

  const bindings: number[] = [];
  const sortedBindings = [...profile.sequenceBindings].sort((a, b) => a.logicalId - b.logicalId || a.sequenceId - b.sequenceId || a.setId - b.setId);
  u16(bindings, sortedBindings.length);
  sortedBindings.forEach((binding) => bindings.push(binding.logicalId, binding.sequenceId, binding.setId, (binding.loop ? 1 : 0) | (binding.cancelOnRelease ? 2 : 0) | transformFlags(binding.transform) | (version === "1.1" && binding.loopSync ? 16 : 0)));

  const definitions: number[] = [profile.sequences.length];
  const compositionCodes: Record<CompositionMode, number> = { or: 0, autoLever: 1, custom: 2 };
  [...profile.sequences].sort((a, b) => a.id - b.id).forEach((seq) => {
    if (version === "1.1") {
      definitions.push(seq.id, seq.steps.length, seq.loopStart, compositionCodes[seq.composition]);
      u24(definitions, seq.suppressionMask);
      definitions.push(0);
    } else definitions.push(seq.id, seq.steps.length, seq.loopStart, 0);
    seq.steps.forEach((step) => { u24(definitions, step.mask); u16(definitions, step.frames); });
  });

  const selectors: number[] = [profile.selectors.length];
  [...profile.selectors].sort((a, b) => a.id - b.id).forEach((item) => {
    selectors.push(item.id, item.increment, item.decrement, item.min, item.max, item.initial, item.wrap ? 1 : 0, item.neutralFrames);
    selectors.push(item.outputs.length, 0);
    if (version === "1.1") u24(selectors, item.occupancyMask);
    item.outputs.forEach((mask) => u24(selectors, mask));
  });

  const rapid: number[] = [];
  const triggerCodes: Record<RapidTriggerType, number> = { disabled: 0, sync: 1, front: 2, back: 3 };
  profile.rapidFire.forEach((item) => rapid.push(item.override ? 1 : 0, triggerCodes[item.triggerType], item.divisor));

  const macroSets = [profile.macroSets.names.length, 0];
  const profileSettings = [profile.frameStep, profile.twoPlayerOutputs ? 1 : 0];

  const metadata = compileMetadata(profile);
  const payload = [
    ...section(0x01, direct), ...section(0x02, bindings), ...section(0x03, definitions),
    ...section(0x04, selectors), ...section(0x05, rapid), ...section(0x06, macroSets), ...section(0x07, profileSettings), ...section(0x08, metadata),
  ];
  const total = 16 + payload.length;
  if (total > MAX_PROFILE_BYTES) throw new Error(`ファイルが8KBを超えます（${total} bytes）`);
  const result = new Uint8Array(total);
  result.set([0x41, 0x4d, 0x41, 0x50, 1, version === "1.1" ? 1 : 0, 16, 0]);
  new DataView(result.buffer).setUint32(8, total, true);
  result.set(payload, 16);
  new DataView(result.buffer).setUint32(12, crc32(result.subarray(16)), true);
  return result;
}

export function parseProfile(bytes: Uint8Array): Profile {
  if (bytes.length < 16 || String.fromCharCode(...bytes.subarray(0, 4)) !== "AMAP") throw new Error("AMAPファイルではありません");
  if (bytes.length > MAX_PROFILE_BYTES) throw new Error("ファイルが8KBを超えています");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minor = bytes[5];
  if (bytes[4] !== 1 || minor > 2) throw new Error("未対応のファイルバージョンです");
  if (read16(view, 6) !== 16 || view.getUint32(8, true) !== bytes.length) throw new Error("ヘッダのサイズが不正です");
  if (view.getUint32(12, true) !== crc32(bytes.subarray(16))) throw new Error("CRC32が一致しません");

  const sections = new Map<number, Uint8Array>();
  let cursor = 16;
  while (cursor < bytes.length) {
    if (cursor + 4 > bytes.length) throw new Error("セクションヘッダが途中で終了しています");
    const type = bytes[cursor], flags = bytes[cursor + 1], length = read16(view, cursor + 2);
    if (flags !== 0 || cursor + 4 + length > bytes.length) throw new Error("セクションが不正です");
    if (sections.has(type)) throw new Error("セクションが重複しています");
    sections.set(type, bytes.subarray(cursor + 4, cursor + 4 + length));
    cursor += 4 + length;
  }

  const direct = sections.get(1), bindingData = sections.get(2), defs = sections.get(3), selectorData = sections.get(4), rapidData = sections.get(5), macroSetData = sections.get(6), profileSettings = sections.get(7);
  const supportedDirectLengths = [34, 36, 54, LOGICAL_BUTTONS.length * 3];
  if (!direct || !supportedDirectLengths.includes(direct.length) || !bindingData) throw new Error("必須セクションがありません");
  const outputWidth = direct.length === 54 || direct.length === LOGICAL_BUTTONS.length * 3 ? 3 : 2;
  const directView = new DataView(direct.buffer, direct.byteOffset, direct.byteLength);
  const storedLogicalCount = direct.length / outputWidth;
  const mappings = Array.from({ length: LOGICAL_BUTTONS.length }, (_, i) => i < storedLogicalCount ? outputWidth === 3 ? read24(direct, i * 3) : directView.getUint16(i * 2, true) : 0);

  const sequenceBindings: SequenceBinding[] = [];
  const legacyCompositionBySequence = new Map<number, { composition: CompositionMode; suppressionMask: number }>();
  const countedBindingCount = bindingData.length >= 2 ? new DataView(bindingData.buffer, bindingData.byteOffset, bindingData.byteLength).getUint16(0, true) : -1;
  const recordSize = bindingData.length === 2 + countedBindingCount * 8 ? 8 : bindingData.length === 2 + countedBindingCount * 4 ? 4 : bindingData.length === 2 + countedBindingCount * 3 ? 3 : bindingData.length === 2 + countedBindingCount * 5 ? 5 : 0;
  const legacyBinding = (logicalId: number, sequenceId: number, setId: number, flags: number): SequenceBinding => ({
    logicalId, sequenceId, setId, loop: !!(flags & 1), loopSync: false, cancelOnRelease: !!(flags & 2),
    transform: transformFromFlags(flags),
  });
  if (!recordSize && bindingData.length === 34) {
    for (let logicalId = 0; logicalId < 17; logicalId++) {
      const sequenceId = bindingData[logicalId * 2], flags = bindingData[logicalId * 2 + 1];
      if (sequenceId !== 0xff) sequenceBindings.push(legacyBinding(logicalId, sequenceId, 0, flags));
    }
  } else {
    if (!recordSize) throw new Error("Sequence Bindingの長さが不正です");
    for (let i = 0, p = 2; i < countedBindingCount; i++, p += recordSize) {
      const logicalId = bindingData[p], sequenceId = bindingData[p + 1];
      if (recordSize === 8) {
        const setId = bindingData[p + 2], flags = bindingData[p + 3], compositionCode = bindingData[p + 4];
        if (flags & ~31 || compositionCode > 2) throw new Error("Sequence Bindingの長さが不正です");
        const compositions: CompositionMode[] = ["or", "autoLever", "custom"];
        const legacyComposition = { composition: compositions[compositionCode], suppressionMask: read24(bindingData, p + 5) };
        if (!legacyCompositionBySequence.has(sequenceId)) legacyCompositionBySequence.set(sequenceId, legacyComposition);
        sequenceBindings.push({ logicalId, sequenceId, setId, loop: !!(flags & 1), loopSync: !!(flags & 16), cancelOnRelease: !!(flags & 2), transform: transformFromFlags(flags) });
      } else if (recordSize === 5) {
        const flags = bindingData[p + 2], setMask = bindingData[p + 3] | (bindingData[p + 4] << 8);
        for (let setId = 0; setId < 16; setId++) if (setMask & (1 << setId)) sequenceBindings.push(legacyBinding(logicalId, sequenceId, setId, flags));
      } else {
        const setId = recordSize === 4 ? bindingData[p + 2] : 0, flags = bindingData[p + recordSize - 1];
        if (flags & ~(minor === 1 && recordSize === 4 ? 31 : 15)) throw new Error("Sequence Bindingの長さが不正です");
        const binding = legacyBinding(logicalId, sequenceId, setId, flags);
        if (minor === 1 && recordSize === 4) binding.loopSync = !!(flags & 16);
        sequenceBindings.push(binding);
      }
    }
  }

  let macroSets: MacroSetConfig = { names: ["Set 0"] };
  let frameStep = 1;
  let twoPlayerOutputs = false;
  let hasGlobalFrameStep = false;
  if (profileSettings) {
    const flags = profileSettings[1];
    if (profileSettings.length !== 2 || profileSettings[0] < 1 || (flags & ~1) || (outputWidth === 2 && flags !== 0)) throw new Error("Profile Settingsセクションが不正です");
    frameStep = profileSettings[0]; twoPlayerOutputs = !!(flags & 1); hasGlobalFrameStep = true;
  }
  if (macroSetData) {
    const legacySixByte = macroSetData.length === 6 && macroSetData[5] === 0;
    if ((!legacySixByte && (macroSetData.length !== 2 || macroSetData[1] !== 0)) || macroSetData[0] < 1 || macroSetData[0] > 16) throw new Error("Macro Setsセクションが不正です");
    macroSets = { names: Array.from({ length: macroSetData[0] }, (_, index) => `Set ${index}`) };
  }

  const sequences: MacroSequence[] = [];
  let legacyFrameStep = 0;
  if (defs) {
    const parseDefinitions = (headerSize: 4 | 8): MacroSequence[] => {
      const parsed: MacroSequence[] = [];
      const dv = new DataView(defs.buffer, defs.byteOffset, defs.byteLength);
      let p = 1;
      for (let n = 0; n < defs[0]; n++) {
        if (p + headerSize > defs.length) throw new Error("シーケンス定義が途中で終了しています");
        const id = defs[p], count = defs[p + 1], loopStart = defs[p + 2];
        let composition: CompositionMode = "or", suppressionMask = 0;
        if (headerSize === 8) {
          const compositionCode = defs[p + 3];
          if (compositionCode > 2 || defs[p + 7] !== 0) throw new Error("シーケンス定義が不正です");
          composition = (["or", "autoLever", "custom"] as CompositionMode[])[compositionCode];
          suppressionMask = read24(defs, p + 4);
        } else {
          const legacy = legacyCompositionBySequence.get(id);
          if (legacy) ({ composition, suppressionMask } = legacy);
          const definitionReserved = defs[p + 3];
          if (!hasGlobalFrameStep && !legacyFrameStep && definitionReserved) legacyFrameStep = definitionReserved;
        }
        p += headerSize;
        const steps: SequenceStep[] = [];
        const stepSize = outputWidth + 2;
        for (let i = 0; i < count; i++, p += stepSize) {
          if (p + stepSize > defs.length) throw new Error("ステップが途中で終了しています");
          steps.push({ mask: outputWidth === 3 ? read24(defs, p) : dv.getUint16(p, true), frames: dv.getUint16(p + outputWidth, true) });
        }
        const sequence: MacroSequence = { id, name: `Macro ${id + 1}`, loopStart, composition, suppressionMask, steps };
        if (minor === 0 && headerSize === 4) {
          sequence.composition = "autoLever";
          sequence.suppressionMask = automaticSuppressionMask(sequence);
        }
        parsed.push(sequence);
      }
      if (p !== defs.length) throw new Error("シーケンス定義に余剰データがあります");
      return parsed;
    };
    if (minor === 1) {
      try { sequences.push(...parseDefinitions(8)); }
      catch { sequences.push(...parseDefinitions(4)); }
    } else sequences.push(...parseDefinitions(4));
  }
  if (!hasGlobalFrameStep && legacyFrameStep) frameStep = legacyFrameStep;

  let selectors: StateSelector[] = [];
  if (selectorData) {
    const parseSelectors = (headerSize: 10 | 12 | 13): StateSelector[] => {
      const parsed: StateSelector[] = [];
      const dv = new DataView(selectorData.buffer, selectorData.byteOffset, selectorData.byteLength);
      let p = 1;
      for (let n = 0; n < selectorData[0]; n++) {
        if (p + headerSize > selectorData.length) throw new Error("セレクタ定義が途中で終了しています");
        const id = selectorData[p], increment = selectorData[p + 1], decrement = selectorData[p + 2], min = selectorData[p + 3], max = selectorData[p + 4], initial = selectorData[p + 5];
        const wrap = !!(selectorData[p + 6] & 1), neutralFrames = selectorData[p + 7], count = selectorData[p + (headerSize === 12 ? 10 : 8)];
        const occupancyMask = headerSize === 13 ? read24(selectorData, p + 10) : 0;
        p += headerSize;
        const outputs: number[] = [];
        for (let i = 0; i < count; i++, p += outputWidth) {
          if (p + outputWidth > selectorData.length) throw new Error("状態出力が途中で終了しています");
          outputs.push(outputWidth === 3 ? read24(selectorData, p) : dv.getUint16(p, true));
        }
        parsed.push({ id, name: `Selector ${id + 1}`, increment, decrement, min, max, initial, wrap, neutralFrames, occupancyMask, outputs, stateNames: outputs.map((_, index) => String(min + index)) });
      }
      if (p !== selectorData.length) throw new Error("セレクタ定義に余剰データがあります");
      return parsed;
    };
    try { selectors = parseSelectors(13); } catch {
      try { selectors = parseSelectors(10); } catch { selectors = parseSelectors(12); }
    }
  }

  const rapidFire = inheritedRapidFire();
  if (rapidData) {
    if (![51, 54, LOGICAL_BUTTONS.length * 3].includes(rapidData.length)) throw new Error("Rapid Fire Overridesの長さが不正です");
    for (let i = 0; i < rapidData.length / 3; i++) {
      if (minor === 2) {
        const oldMode = rapidData[i * 3], oldOn = rapidData[i * 3 + 1], oldOff = rapidData[i * 3 + 2];
        rapidFire[i] = { override: oldMode !== 0, triggerType: oldMode === 1 ? "disabled" : "sync", divisor: Math.max(2, Math.min(60, oldOn + oldOff || 2)) };
      } else {
        const types: RapidTriggerType[] = ["disabled", "sync", "front", "back"];
        rapidFire[i] = { override: !!rapidData[i * 3], triggerType: types[rapidData[i * 3 + 1]] ?? "disabled", divisor: rapidData[i * 3 + 2] || 2 };
      }
    }
  }

  let name = "Imported Profile", description = "";
  let metadata: ProfileMetadata | undefined;
  const compactMetadata = sections.get(0x08);
  if (compactMetadata) {
    const parsed = parseMetadata(compactMetadata, sequences, macroSets, selectors);
    name = parsed.name || name; description = parsed.description;
  } else {
    const meta = sections.get(0x7f);
    if (meta) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(meta));
        name = parsed.name || name; description = parsed.description || "";
        sequences.forEach((s) => { s.name = parsed.sequenceNames?.[s.id] || s.name; });
        if (Array.isArray(parsed.macroSetNames)) macroSets.names = macroSets.names.map((fallback, index) => typeof parsed.macroSetNames[index] === "string" ? parsed.macroSetNames[index] : fallback);
        selectors.forEach((s) => {
          s.name = parsed.selectorNames?.[s.id] || s.name;
          const stateNames = parsed.selectorStateNames?.[s.id];
          if (Array.isArray(stateNames)) s.stateNames = s.outputs.map((_, index) => typeof stateNames[index] === "string" ? stateNames[index] : s.stateNames[index]);
        });
        const { schemaVersion: _schemaVersion, name: _name, description: _description, sequenceNames: _sequenceNames, macroSetNames: _macroSetNames, selectorNames: _selectorNames, selectorStateNames: _selectorStateNames, ...extra } = parsed;
        void _schemaVersion; void _name; void _description; void _sequenceNames; void _macroSetNames; void _selectorNames; void _selectorStateNames;
        if (Object.keys(extra).length) metadata = extra;
      } catch { /* optional legacy metadata */ }
    }
  }
  const profile: Profile = { schemaVersion: 1, name, description, frameStep, twoPlayerOutputs, mappings, rapidFire, sequenceBindings, sequences, macroSets, selectors, ...(metadata ? { metadata } : {}) };
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(errors[0]);
  return profile;
}

type LegacyBinding = {
  logicalId?: number; sequenceId: number | null; setId?: number; loop: boolean; loopSync?: boolean; cancelOnRelease: boolean;
  delayFrames?: number; transform?: OutputTransform; setMask?: number; composition?: CompositionMode; suppressionMask?: number;
};
type LegacySequence = Omit<MacroSequence, "composition" | "suppressionMask"> & Partial<Pick<MacroSequence, "composition" | "suppressionMask">> & { frameStep?: number; trigger?: number; loop?: boolean; cancelOnRelease?: boolean };

export function normalizeProfile(candidate: Partial<Profile> & { sequenceBindings?: LegacyBinding[]; sequences?: LegacySequence[] }): Profile {
  const base = createDefaultProfile();
  const candidateBindings = candidate.sequenceBindings as LegacyBinding[] | undefined;
  const candidateSequences: LegacySequence[] = candidate.sequences ?? base.sequences;
  const legacyFrameStep = candidateSequences.find((sequence) => Number.isInteger(sequence.frameStep))?.frameStep;
  const sequences: MacroSequence[] = candidateSequences.map((sequence) => ({
    id: sequence.id,
    name: sequence.name,
    loopStart: sequence.loopStart,
    steps: sequence.steps.map((step) => ({ ...step })),
    composition: sequence.composition ?? candidateBindings?.find((binding) => binding.sequenceId === sequence.id)?.composition ?? "or",
    suppressionMask: sequence.suppressionMask ?? candidateBindings?.find((binding) => binding.sequenceId === sequence.id)?.suppressionMask ?? 0,
  }));
  let sequenceBindings: SequenceBinding[] = [];
  function migrateBinding(binding: LegacyBinding, logicalId: number): SequenceBinding[] {
    if (binding.sequenceId === null) return [];
    const common = {
      logicalId, sequenceId: binding.sequenceId, loop: binding.loop, loopSync: binding.loopSync === true,
      cancelOnRelease: binding.cancelOnRelease, transform: binding.transform ?? "none" as OutputTransform,
    };
    if (typeof binding.setId === "number") return [{ ...common, setId: binding.setId }];
    const setMask = binding.setMask ?? 1;
    return Array.from({ length: 16 }, (_, setId) => setId).filter((setId) => setMask & (1 << setId)).map((setId) => ({ ...common, setId }));
  }
  if (Array.isArray(candidateBindings)) {
    const isFlat = candidateBindings.every((binding) => typeof binding.logicalId === "number");
    if (isFlat) {
      sequenceBindings = candidateBindings.flatMap((binding) => migrateBinding(binding, binding.logicalId!));
    } else {
      candidateBindings.forEach((binding, logicalId) => sequenceBindings.push(...migrateBinding(binding, logicalId)));
    }
  } else {
    candidateSequences.forEach((sequence) => { if (typeof sequence.trigger === "number") sequenceBindings.push({ logicalId: sequence.trigger, sequenceId: sequence.id, setId: 0, loop: !!sequence.loop, loopSync: false, cancelOnRelease: !!sequence.cancelOnRelease, transform: "none" }); });
  }
  sequences.forEach((sequence) => {
    if (sequence.composition === "or") sequence.suppressionMask = 0;
    else if (sequence.composition === "autoLever") sequence.suppressionMask = automaticSuppressionMask(sequence);
  });
  const inheritedRapid = inheritedRapidFire();
  const rapidFire = Array.isArray(candidate.rapidFire)
    ? inheritedRapid.map((fallback, index) => {
        const rapid = candidate.rapidFire?.[index];
        if (!rapid) return fallback;
        if ("override" in rapid) return rapid;
        const legacy = rapid as unknown as { mode: "inherit" | "off" | "custom"; onFrames: number; offFrames: number };
        return { override: legacy.mode !== "inherit", triggerType: legacy.mode === "off" ? "disabled" as const : "sync" as const, divisor: Math.max(2, Math.min(60, (legacy.onFrames || 0) + (legacy.offFrames || 0) || 2)) };
      })
    : inheritedRapid;
  const selectors = (candidate.selectors ?? base.selectors).map((selector) => ({
    id: selector.id, name: selector.name, increment: selector.increment, decrement: selector.decrement,
    min: selector.min, max: selector.max, initial: selector.initial, wrap: selector.wrap,
    neutralFrames: selector.neutralFrames, occupancyMask: selector.occupancyMask ?? 0, outputs: [...selector.outputs],
    stateNames: selector.outputs.map((_, index) => Array.isArray(selector.stateNames) && typeof selector.stateNames[index] === "string" ? selector.stateNames[index] : String(selector.min + index)),
  }));
  return {
    ...base, ...candidate, schemaVersion: 1, sequences,
    twoPlayerOutputs: candidate.twoPlayerOutputs === true,
    frameStep: Number.isInteger(candidate.frameStep) ? Math.max(1, Math.min(255, candidate.frameStep!))
      : Number.isInteger(legacyFrameStep) ? Math.max(1, Math.min(255, legacyFrameStep!)) : 1,
    mappings: LOGICAL_BUTTONS.map((_, index) => candidate.mappings?.[index] ?? base.mappings[index]),
    rapidFire,
    sequenceBindings,
    macroSets: candidate.macroSets && Array.isArray(candidate.macroSets.names) && candidate.macroSets.names.length
      ? { names: candidate.macroSets.names.slice(0, 16) }
      : base.macroSets,
    selectors,
  };
}
