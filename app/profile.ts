export const LOGICAL_BUTTONS = [
  "COIN", "START", "UP", "DOWN", "LEFT", "RIGHT",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;

export const OUTPUTS = [
  "COIN", "START", "UP", "DOWN", "LEFT", "RIGHT", "A", "B", "C", "D", "E", "F",
] as const;

export const MAX_PROFILE_BYTES = 8192;
export const MAX_SEQUENCE_BINDINGS = 256;

export type SequenceStep = { mask: number; frames: number };
export type MacroSequence = { id: number; name: string; loopStart: number; steps: SequenceStep[] };
export type OutputTransform = "none" | "flipHorizontal" | "flipVertical" | "flipBoth";
export type SequenceBinding = { logicalId: number; sequenceId: number; setId: number; loop: boolean; cancelOnRelease: boolean; transform: OutputTransform };
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
  neutralFrames: number; outputs: number[]; stateNames: string[];
};
export type Profile = {
  schemaVersion: 1;
  name: string;
  description: string;
  frameStep: number;
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
    "シーケンスは64件までです": "A profile can contain up to 64 sequences",
    "マクロセットは1〜16件必要です": "A profile must contain 1–16 macro sets",
    "ステートセレクタは8件までです": "A profile can contain up to 8 state selectors",
    "全シーケンスの合計は1024ステップまでです": "All sequences combined can contain up to 1,024 steps",
    "マクロ割り当ての論理ボタンが不正です": "A macro assignment has an invalid logical button",
    "マクロ割り当ての出力変換が不正です": "A macro assignment has an invalid output transform",
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
    mappings: LOGICAL_BUTTONS.map((_, i) => (i < OUTPUTS.length ? 1 << i : 0)),
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
function section(type: number, payload: number[]): number[] { return [type, 0, payload.length & 0xff, (payload.length >>> 8) & 0xff, ...payload]; }
function read16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function transformFromFlags(flags: number): OutputTransform {
  return (flags & 12) === 12 ? "flipBoth" : flags & 4 ? "flipHorizontal" : flags & 8 ? "flipVertical" : "none";
}
function transformFlags(transform: OutputTransform): number {
  return transform === "flipBoth" ? 12 : transform === "flipHorizontal" ? 4 : transform === "flipVertical" ? 8 : 0;
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

export function validateProfile(profile: Profile): string[] {
  const errors: string[] = [];
  if (profile.mappings.length !== LOGICAL_BUTTONS.length) errors.push(`直接マッピングは${LOGICAL_BUTTONS.length}件必要です`);
  if (profile.rapidFire.length !== LOGICAL_BUTTONS.length) errors.push(`連射設定は${LOGICAL_BUTTONS.length}件必要です`);
  if (profile.sequenceBindings.length > MAX_SEQUENCE_BINDINGS) errors.push(`マクロ割り当ては${MAX_SEQUENCE_BINDINGS}件までです`);
  if (!Number.isInteger(profile.frameStep) || profile.frameStep < 1 || profile.frameStep > 255) errors.push("基本フレームステップが不正です");
  if (profile.sequences.length > 64) errors.push("シーケンスは64件までです");
  if (!profile.macroSets || profile.macroSets.names.length < 1 || profile.macroSets.names.length > 16) errors.push("マクロセットは1〜16件必要です");
  const macroSetCount = profile.macroSets?.names.length ?? 0;
  if (profile.selectors.length > 8) errors.push("ステートセレクタは8件までです");
  profile.mappings.forEach((mask, i) => { if (mask & ~0x0fff) errors.push(`${LOGICAL_BUTTONS[i]}の出力マスクが不正です`); });
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
    if (seq.steps.some((step) => step.frames < 1 || step.frames > 65535 || !!(step.mask & ~0x0fff))) errors.push(`${seq.name}: ステップが不正です`);
  }
  if (totalSteps > 1024) errors.push("全シーケンスの合計は1024ステップまでです");
  const bindingKeys = new Set<string>();
  for (const binding of profile.sequenceBindings) {
    const key = `${binding.setId}:${binding.logicalId}:${binding.sequenceId}`;
    if (binding.logicalId < 0 || binding.logicalId >= LOGICAL_BUTTONS.length) errors.push("マクロ割り当ての論理ボタンが不正です");
    if (!ids.has(binding.sequenceId)) errors.push(`${LOGICAL_BUTTONS[binding.logicalId] ?? "不明"}が未定義のシーケンスを参照しています`);
    if (!(binding.transform === "none" || binding.transform === "flipHorizontal" || binding.transform === "flipVertical" || binding.transform === "flipBoth")) errors.push("マクロ割り当ての出力変換が不正です");
    if (!Number.isInteger(binding.setId) || binding.setId < 0 || binding.setId >= macroSetCount) errors.push("マクロ割り当てのSet IDが不正です");
    if (bindingKeys.has(key)) errors.push("同じセット、論理ボタン、マクロの割り当てが重複しています");
    bindingKeys.add(key);
  }

  const selectorIds = new Set<number>();
  for (const selector of profile.selectors) {
    if (selectorIds.has(selector.id)) errors.push(`セレクタID ${selector.id} が重複しています`);
    selectorIds.add(selector.id);
    if (selector.increment === selector.decrement || selector.increment < 0 || selector.increment >= LOGICAL_BUTTONS.length || selector.decrement < 0 || selector.decrement >= LOGICAL_BUTTONS.length) errors.push(`${selector.name}: 増加・減少ボタンが不正です`);
    if (selector.max < selector.min || selector.outputs.length !== selector.max - selector.min + 1 || selector.initial < selector.min || selector.initial > selector.max) errors.push(`${selector.name}: 状態範囲と出力数が一致しません`);
    if (!Array.isArray(selector.stateNames) || selector.stateNames.length !== selector.outputs.length || selector.stateNames.some((name) => typeof name !== "string")) errors.push(`${selector.name}: ステート名と状態数が一致しません`);
    if (selector.outputs.length > 64) errors.push(`${selector.name}: 状態は64件までです`);
    if (selector.outputs.some((mask) => mask & ~0x0fff)) errors.push(`${selector.name}: 状態出力マスクが不正です`);
  }
  return errors;
}

export function compileProfile(profile: Profile): Uint8Array {
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(errors[0]);

  const direct: number[] = [];
  profile.mappings.forEach((mask) => u16(direct, mask));

  const bindings: number[] = [];
  const sortedBindings = [...profile.sequenceBindings].sort((a, b) => a.logicalId - b.logicalId || a.sequenceId - b.sequenceId || a.setId - b.setId);
  u16(bindings, sortedBindings.length);
  sortedBindings.forEach((binding) => bindings.push(binding.logicalId, binding.sequenceId, binding.setId, (binding.loop ? 1 : 0) | (binding.cancelOnRelease ? 2 : 0) | transformFlags(binding.transform)));

  const definitions: number[] = [profile.sequences.length];
  [...profile.sequences].sort((a, b) => a.id - b.id).forEach((seq) => {
    definitions.push(seq.id, seq.steps.length, seq.loopStart, 0);
    seq.steps.forEach((step) => { u16(definitions, step.mask); u16(definitions, step.frames); });
  });

  const selectors: number[] = [profile.selectors.length];
  [...profile.selectors].sort((a, b) => a.id - b.id).forEach((item) => {
    selectors.push(item.id, item.increment, item.decrement, item.min, item.max, item.initial, item.wrap ? 1 : 0, item.neutralFrames);
    selectors.push(item.outputs.length, 0);
    item.outputs.forEach((mask) => u16(selectors, mask));
  });

  const rapid: number[] = [];
  const triggerCodes: Record<RapidTriggerType, number> = { disabled: 0, sync: 1, front: 2, back: 3 };
  profile.rapidFire.forEach((item) => rapid.push(item.override ? 1 : 0, triggerCodes[item.triggerType], item.divisor));

  const macroSets = [profile.macroSets.names.length, 0];
  const profileSettings = [profile.frameStep, 0];

  const metadata = compileMetadata(profile);
  const payload = [
    ...section(0x01, direct), ...section(0x02, bindings), ...section(0x03, definitions),
    ...section(0x04, selectors), ...section(0x05, rapid), ...section(0x06, macroSets), ...section(0x07, profileSettings), ...section(0x08, metadata),
  ];
  const total = 16 + payload.length;
  if (total > MAX_PROFILE_BYTES) throw new Error(`ファイルが8KBを超えます（${total} bytes）`);
  const result = new Uint8Array(total);
  result.set([0x41, 0x4d, 0x41, 0x50, 1, 0, 16, 0]);
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
  if (!direct || ![34, LOGICAL_BUTTONS.length * 2].includes(direct.length) || !bindingData) throw new Error("必須セクションがありません");
  const directView = new DataView(direct.buffer, direct.byteOffset, direct.byteLength);
  const storedLogicalCount = direct.length / 2;
  const mappings = Array.from({ length: LOGICAL_BUTTONS.length }, (_, i) => i < storedLogicalCount ? directView.getUint16(i * 2, true) : 0);

  const sequenceBindings: SequenceBinding[] = [];
  const countedBindingCount = bindingData.length >= 2 ? new DataView(bindingData.buffer, bindingData.byteOffset, bindingData.byteLength).getUint16(0, true) : -1;
  const recordSize = bindingData.length === 2 + countedBindingCount * 4 ? 4 : bindingData.length === 2 + countedBindingCount * 3 ? 3 : bindingData.length === 2 + countedBindingCount * 5 ? 5 : 0;
  if (!recordSize && bindingData.length === 34) {
    for (let logicalId = 0; logicalId < 17; logicalId++) {
      const sequenceId = bindingData[logicalId * 2], flags = bindingData[logicalId * 2 + 1];
      if (sequenceId !== 0xff) sequenceBindings.push({ logicalId, sequenceId, setId: 0, loop: !!(flags & 1), cancelOnRelease: !!(flags & 2), transform: transformFromFlags(flags) });
    }
  } else {
    if (!recordSize) throw new Error("Sequence Bindingの長さが不正です");
    for (let i = 0, p = 2; i < countedBindingCount; i++, p += recordSize) {
      const logicalId = bindingData[p], sequenceId = bindingData[p + 1];
      if (recordSize === 5) {
        const flags = bindingData[p + 2], setMask = bindingData[p + 3] | (bindingData[p + 4] << 8);
        for (let setId = 0; setId < 16; setId++) if (setMask & (1 << setId)) sequenceBindings.push({ logicalId, sequenceId, setId, loop: !!(flags & 1), cancelOnRelease: !!(flags & 2), transform: transformFromFlags(flags) });
      } else {
        const setId = recordSize === 4 ? bindingData[p + 2] : 0, flags = bindingData[p + recordSize - 1];
        sequenceBindings.push({ logicalId, sequenceId, setId, loop: !!(flags & 1), cancelOnRelease: !!(flags & 2), transform: transformFromFlags(flags) });
      }
    }
  }

  let macroSets: MacroSetConfig = { names: ["Set 0"] };
  let frameStep = 1;
  let hasGlobalFrameStep = false;
  if (profileSettings) {
    if (profileSettings.length !== 2 || profileSettings[0] < 1 || profileSettings[1] !== 0) throw new Error("Profile Settingsセクションが不正です");
    frameStep = profileSettings[0]; hasGlobalFrameStep = true;
  }
  if (macroSetData) {
    const legacySixByte = macroSetData.length === 6 && macroSetData[5] === 0;
    if ((!legacySixByte && (macroSetData.length !== 2 || macroSetData[1] !== 0)) || macroSetData[0] < 1 || macroSetData[0] > 16) throw new Error("Macro Setsセクションが不正です");
    macroSets = { names: Array.from({ length: macroSetData[0] }, (_, index) => `Set ${index}`) };
  }

  const sequences: MacroSequence[] = [];
  let legacyFrameStep = 0;
  if (defs) {
    const dv = new DataView(defs.buffer, defs.byteOffset, defs.byteLength);
    let p = 1;
    for (let n = 0; n < defs[0]; n++) {
      if (p + 4 > defs.length) throw new Error("シーケンス定義が途中で終了しています");
      const id = defs[p], count = defs[p + 1], loopStart = defs[p + 2], definitionReserved = defs[p + 3]; p += 4;
      if (!hasGlobalFrameStep && !legacyFrameStep && definitionReserved) legacyFrameStep = definitionReserved;
      const steps: SequenceStep[] = [];
      for (let i = 0; i < count; i++, p += 4) {
        if (p + 4 > defs.length) throw new Error("ステップが途中で終了しています");
        steps.push({ mask: dv.getUint16(p, true), frames: dv.getUint16(p + 2, true) });
      }
      sequences.push({ id, name: `Macro ${id + 1}`, loopStart, steps });
    }
    if (p !== defs.length) throw new Error("シーケンス定義に余剰データがあります");
  }
  if (!hasGlobalFrameStep && legacyFrameStep) frameStep = legacyFrameStep;

  let selectors: StateSelector[] = [];
  if (selectorData) {
    const parseSelectors = (headerSize: 10 | 12): StateSelector[] => {
      const parsed: StateSelector[] = [];
      const dv = new DataView(selectorData.buffer, selectorData.byteOffset, selectorData.byteLength);
      let p = 1;
      for (let n = 0; n < selectorData[0]; n++) {
        if (p + headerSize > selectorData.length) throw new Error("セレクタ定義が途中で終了しています");
        const id = selectorData[p], increment = selectorData[p + 1], decrement = selectorData[p + 2], min = selectorData[p + 3], max = selectorData[p + 4], initial = selectorData[p + 5];
        const wrap = !!(selectorData[p + 6] & 1), neutralFrames = selectorData[p + 7], count = selectorData[p + headerSize - 2];
        p += headerSize;
        const outputs: number[] = [];
        for (let i = 0; i < count; i++, p += 2) {
          if (p + 2 > selectorData.length) throw new Error("状態出力が途中で終了しています");
          outputs.push(dv.getUint16(p, true));
        }
        parsed.push({ id, name: `Selector ${id + 1}`, increment, decrement, min, max, initial, wrap, neutralFrames, outputs, stateNames: outputs.map((_, index) => String(min + index)) });
      }
      if (p !== selectorData.length) throw new Error("セレクタ定義に余剰データがあります");
      return parsed;
    };
    try { selectors = parseSelectors(10); } catch { selectors = parseSelectors(12); }
  }

  const rapidFire = inheritedRapidFire();
  if (rapidData) {
    if (![51, LOGICAL_BUTTONS.length * 3].includes(rapidData.length)) throw new Error("Rapid Fire Overridesの長さが不正です");
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
  const profile: Profile = { schemaVersion: 1, name, description, frameStep, mappings, rapidFire, sequenceBindings, sequences, macroSets, selectors, ...(metadata ? { metadata } : {}) };
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(errors[0]);
  return profile;
}

type LegacyBinding = { logicalId?: number; sequenceId: number | null; setId?: number; loop: boolean; cancelOnRelease: boolean; delayFrames?: number; transform?: OutputTransform; setMask?: number };
type LegacySequence = MacroSequence & { frameStep?: number; trigger?: number; loop?: boolean; cancelOnRelease?: boolean };

export function normalizeProfile(candidate: Partial<Profile> & { sequenceBindings?: LegacyBinding[]; sequences?: LegacySequence[] }): Profile {
  const base = createDefaultProfile();
  const candidateSequences = candidate.sequences ?? base.sequences;
  const legacyFrameStep = candidateSequences.find((sequence) => Number.isInteger(sequence.frameStep))?.frameStep;
  const sequences: MacroSequence[] = candidateSequences.map((sequence) => ({
    id: sequence.id,
    name: sequence.name,
    loopStart: sequence.loopStart,
    steps: sequence.steps.map((step) => ({ ...step })),
  }));
  let sequenceBindings: SequenceBinding[] = [];
  function migrateBinding(binding: LegacyBinding, logicalId: number): SequenceBinding[] {
    if (binding.sequenceId === null) return [];
    const common = { logicalId, sequenceId: binding.sequenceId, loop: binding.loop, cancelOnRelease: binding.cancelOnRelease, transform: binding.transform ?? "none" as OutputTransform };
    if (typeof binding.setId === "number") return [{ ...common, setId: binding.setId }];
    const setMask = binding.setMask ?? 1;
    return Array.from({ length: 16 }, (_, setId) => setId).filter((setId) => setMask & (1 << setId)).map((setId) => ({ ...common, setId }));
  }
  if (Array.isArray(candidate.sequenceBindings)) {
    const isFlat = candidate.sequenceBindings.every((binding) => typeof binding.logicalId === "number");
    if (isFlat) {
      sequenceBindings = candidate.sequenceBindings.flatMap((binding) => migrateBinding(binding, binding.logicalId!));
    } else {
      candidate.sequenceBindings.forEach((binding, logicalId) => sequenceBindings.push(...migrateBinding(binding, logicalId)));
    }
  } else {
    sequences.forEach((sequence) => { if (typeof sequence.trigger === "number") sequenceBindings.push({ logicalId: sequence.trigger, sequenceId: sequence.id, setId: 0, loop: !!sequence.loop, cancelOnRelease: !!sequence.cancelOnRelease, transform: "none" }); });
  }
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
    neutralFrames: selector.neutralFrames, outputs: [...selector.outputs],
    stateNames: selector.outputs.map((_, index) => Array.isArray(selector.stateNames) && typeof selector.stateNames[index] === "string" ? selector.stateNames[index] : String(selector.min + index)),
  }));
  return {
    ...base, ...candidate, schemaVersion: 1, sequences,
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
