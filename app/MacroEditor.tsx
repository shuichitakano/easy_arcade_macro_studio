"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  bindingsFor, compileProfile, createDefaultProfile, EDITOR_LOGICAL_BUTTONS, MacroSequence,
  localizeProfileMessage, MAX_SEQUENCE_BINDINGS, normalizeProfile, OUTPUTS, OutputTransform, parseProfile, PLAYER_OUTPUTS, Profile, SequenceBinding, StateSelector, validateProfile,
} from "./profile";
import { parseProfileJsonText, ProfileJsonError, serializeProfileJson } from "./profileJson";
import { listStoredProfiles, removeStoredProfile, saveStoredProfile, StoredProfile } from "./profileStore";
import { copyTickRange, insertTick, insertTickRange, maskAtTick, replaceTickRange, setTickMask, TickClipboard, totalTicks } from "./sequenceEditing";
import { SharedProfiles } from "./SharedProfiles";
import { LanguageSwitch, useI18n } from "./i18n";
import { uniqueDownloadFileName } from "./downloadName";

type Tab = "mapping" | "macro" | "macrosets" | "selector" | "overview" | "share";

function clone<T>(value: T): T { return structuredClone(value); }
const DIRECTION_LABELS: Record<string, string> = { UP: "⬆︎", DOWN: "⬇︎", LEFT: "⬅︎", RIGHT: "➡︎" };
function buttonLabel(button: string) { return DIRECTION_LABELS[button] ?? button; }
function outputLabel(index: number, showPlayer = false) {
  const player = index >= PLAYER_OUTPUTS.length ? 2 : 1;
  const base = PLAYER_OUTPUTS[index % PLAYER_OUTPUTS.length];
  return `${showPlayer ? `${player}P ` : ""}${buttonLabel(base)}`;
}
function maskLabels(mask: number, twoPlayerOutputs: boolean) {
  return OUTPUTS.slice(0, twoPlayerOutputs ? 24 : 12).map((_, index) => ({ key: OUTPUTS[index], label: outputLabel(index, twoPlayerOutputs) })).filter((_, index) => mask & (1 << index));
}
function playerCommand(mask: number, player: 0 | 1) {
  const value = (mask >>> (player * 12)) & 0x0fff;
  const up = !!(value & (1 << 2)), down = !!(value & (1 << 3)), left = !!(value & (1 << 4)), right = !!(value & (1 << 5));
  let direction = "";
  if (up && left && !down && !right) direction = "↖";
  else if (up && right && !down && !left) direction = "↗";
  else if (down && left && !up && !right) direction = "↙";
  else if (down && right && !up && !left) direction = "↘";
  else direction = [up ? "↑" : "", down ? "↓" : "", left ? "←" : "", right ? "→" : ""].filter(Boolean).join("+");
  const buttons = [0, 1, 6, 7, 8, 9, 10, 11].filter((index) => value & (1 << index)).map((index) => PLAYER_OUTPUTS[index]);
  return [direction, ...buttons].filter(Boolean).join("+") || "—";
}
function commandLabel(mask: number, twoPlayerOutputs: boolean) {
  const first = playerCommand(mask, 0), second = playerCommand(mask, 1);
  if (!twoPlayerOutputs || second === "—") return first;
  return first === "—" ? `2P ${second}` : `1P ${first} / 2P ${second}`;
}
function transformAxes(transform: OutputTransform) { return { horizontal: transform === "flipHorizontal" || transform === "flipBoth", vertical: transform === "flipVertical" || transform === "flipBoth" }; }
function transformFromAxes(horizontal: boolean, vertical: boolean): OutputTransform { return horizontal && vertical ? "flipBoth" : horizontal ? "flipHorizontal" : vertical ? "flipVertical" : "none"; }
function newProfileId() { return crypto.randomUUID(); }
function profileFileName(name: string, extension = ".eamacro") { return `${name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "profile"}${extension}`; }
const DOWNLOAD_URL_LIFETIME_MS = 60_000;

type SaveFileHandle = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> };
type FilePickerWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveFileHandle> };

function OutputToggles({ mask, onChange, twoPlayerOutputs, allowed = 0xffffff }: { mask: number; onChange: (mask: number) => void; twoPlayerOutputs: boolean; allowed?: number }) {
  const players = twoPlayerOutputs ? [0, 1] : [0];
  return (
    <div className="output-toggles">
      {players.map((player) => <div className="output-player" key={player}>
        {twoPlayerOutputs && <span className="output-player-label">{player + 1}P</span>}
        <div className="output-player-buttons">{PLAYER_OUTPUTS.map((label, outputIndex) => {
          const index = player * PLAYER_OUTPUTS.length + outputIndex;
          const bit = 1 << index;
          const disabled = !(allowed & bit);
          return <button key={label} type="button" title={label} disabled={disabled} className={mask & bit ? "output-chip active" : "output-chip"} onClick={() => onChange(mask ^ bit)}>{buttonLabel(label)}</button>;
        })}</div>
      </div>)}
    </div>
  );
}

function IntegerInput({ value, min, max, onCommit, ariaLabel }: { value: number; min: number; max: number; onCommit: (value: number) => void; ariaLabel: string }) {
  const [text, setText] = useState(String(value));
  function commit() {
    const parsed = Number(text);
    const next = text.trim() && Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : value;
    setText(String(next));
    if (next !== value) onCommit(next);
  }
  return <input aria-label={ariaLabel} type="number" min={min} max={max} step="1" value={text} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setText(String(value)); event.currentTarget.blur(); }
  }} />;
}

export function MacroEditor() {
  const { locale, t } = useI18n();
  const [profile, setProfile] = useState<Profile>(() => createDefaultProfile());
  const profileRef = useRef(profile);
  const [tab, setTab] = useState<Tab>("mapping");
  const [selectedSequence, setSelectedSequence] = useState(0);
  const [selectedSelector, setSelectedSelector] = useState(0);
  const [selectedMacroSet, setSelectedMacroSet] = useState(0);
  const [timelineClipboard, setTimelineClipboard] = useState<TickClipboard>([]);
  const [notice, setNotice] = useState(() => t("新しいプロファイルを準備しました", "New profile ready"));
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [storedProfiles, setStoredProfiles] = useState<StoredProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const binaryFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const fileMenuRef = useRef<HTMLDetailsElement>(null);
  const frameStepMenuRef = useRef<HTMLDetailsElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let cancelled = false;
    async function restoreProfiles() {
      try {
        let entries = (await listStoredProfiles()).map((entry) => ({ ...entry, profile: normalizeProfile(entry.profile) }));
        if (!entries.length) {
          let initial = createDefaultProfile();
          const legacy = localStorage.getItem("easy-arcade-macro-profile");
          if (legacy) initial = normalizeProfile(JSON.parse(legacy));
          const entry = { id: newProfileId(), profile: initial, updatedAt: Date.now() };
          await saveStoredProfile(entry); entries = [entry];
          localStorage.removeItem("easy-arcade-macro-profile");
        }
        if (cancelled) return;
        const preferredId = localStorage.getItem("easy-arcade-active-profile");
        const active = entries.find((entry) => entry.id === preferredId) ?? entries[0];
        const restoredProfile = clone(active.profile);
        profileRef.current = restoredProfile;
        setStoredProfiles(entries); setActiveProfileId(active.id); setProfile(restoredProfile); setSelectedMacroSet(0);
        setNotice(entries.length > 1 ? tRef.current(`${entries.length}件のプロファイルを復元しました`, `Restored ${entries.length} profiles`) : tRef.current("プロファイルを復元しました", "Profile restored"));
      } catch {
        if (!cancelled) setNotice(tRef.current("ブラウザ内保存を利用できないため、この画面だけで編集します", "Browser storage is unavailable; changes will remain on this page only"));
      } finally { if (!cancelled) setHydrated(true); }
    }
    void restoreProfiles();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") !== "share") return;
    const timer = window.setTimeout(() => setTab("share"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || !activeProfileId) return;
    const entry = { id: activeProfileId, profile: clone(profile), updatedAt: Date.now() };
    window.setTimeout(() => {
      setStoredProfiles((current) => current.map((item) => item.id === activeProfileId ? entry : item));
      localStorage.setItem("easy-arcade-active-profile", activeProfileId);
      void saveStoredProfile(entry).catch(() => setNotice(tRef.current("ブラウザ内へ保存できませんでした", "Could not save in this browser")));
    }, 0);
  }, [profile, activeProfileId, hydrated]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) profileMenuRef.current.open = false;
      if (fileMenuRef.current && !fileMenuRef.current.contains(target)) fileMenuRef.current.open = false;
      if (frameStepMenuRef.current && !frameStepMenuRef.current.contains(target)) frameStepMenuRef.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") closeMenus(); }
    document.addEventListener("pointerdown", closeOnOutsideClick); document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  const errors = useMemo(() => validateProfile(profile).map((message) => localizeProfileMessage(message, locale)), [profile, locale]);
  const seq = profile.sequences[selectedSequence];
  const selector = profile.selectors[selectedSelector];

  function update(mutator: (draft: Profile) => void) {
    const draft = clone(profileRef.current);
    mutator(draft);
    profileRef.current = draft;
    setProfile(draft);
  }

  function showNotice(message: string) {
    setNotice(message); setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => { setToast(""); toastTimerRef.current = null; }, 2800);
  }

  function closeMenus() {
    if (profileMenuRef.current) profileMenuRef.current.open = false;
    if (fileMenuRef.current) fileMenuRef.current.open = false;
    if (frameStepMenuRef.current) frameStepMenuRef.current.open = false;
  }

  function errorMessage(error: unknown, fallbackJa: string, fallbackEn: string) {
    if (error instanceof ProfileJsonError) return error.localizedMessage(locale);
    return error instanceof Error ? localizeProfileMessage(error.message, locale) : t(fallbackJa, fallbackEn);
  }

  async function saveBlob(blob: Blob, suggestedName: string, description: string, mimeType: string, extensions: string[]) {
    const pickerWindow = window as FilePickerWindow;
    if (pickerWindow.showSaveFilePicker) {
      const handle = await pickerWindow.showSaveFilePicker({ suggestedName, types: [{ description, accept: { [mimeType]: extensions } }] });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      showNotice(t(`${suggestedName}を保存しました`, `Saved ${suggestedName}`));
      return;
    }
    const href = URL.createObjectURL(blob);
    const downloadName = uniqueDownloadFileName(suggestedName);
    const link = document.createElement("a");
    link.href = href; link.download = downloadName;
    document.body.append(link); link.click(); link.remove();
    // Some browsers start the actual download after the click task completes.
    // Revoking immediately can leave the previous same-named file as the only
    // usable download, which looks like the latest edit was not exported.
    window.setTimeout(() => URL.revokeObjectURL(href), DOWNLOAD_URL_LIFETIME_MS);
    showNotice(t(`${downloadName}をダウンロードしました`, `Downloaded ${downloadName}`));
  }

  async function saveAsMacro() {
    closeMenus();
    try {
      const currentProfile = profileRef.current;
      const bytes = compileProfile(currentProfile);
      await saveBlob(new Blob([bytes as BlobPart], { type: "application/vnd.easy-arcade.macro" }), profileFileName(currentProfile.name), "EASY ARCADE Macro", "application/vnd.easy-arcade.macro", [".eamacro"]);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(errorMessage(error, "保存できませんでした", "Could not save the profile")); }
  }

  async function saveAsJson() {
    closeMenus();
    try {
      const currentProfile = profileRef.current;
      const json = serializeProfileJson(currentProfile);
      await saveBlob(new Blob([json], { type: "application/vnd.easy-arcade.macro+json;charset=utf-8" }), profileFileName(currentProfile.name, ".eamacro.json"), "EASY ARCADE Profile JSON", "application/vnd.easy-arcade.macro+json", [".eamacro.json", ".json"]);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(errorMessage(error, "保存できませんでした", "Could not save the profile")); }
  }

  function activateProfile(entry: StoredProfile) {
    const nextProfile = clone(entry.profile);
    profileRef.current = nextProfile;
    setActiveProfileId(entry.id); setProfile(nextProfile);
    setSelectedSequence(0); setSelectedSelector(0); setSelectedMacroSet(0);
    closeMenus();
  }

  function addStoredProfile(nextProfile: Profile, message: string) {
    const entry = { id: newProfileId(), profile: nextProfile, updatedAt: Date.now() };
    setStoredProfiles((current) => [entry, ...current]); activateProfile(entry);
    void saveStoredProfile(entry).catch(() => setNotice(t("ブラウザ内へ保存できませんでした", "Could not save in this browser")));
    setNotice(message);
  }

  function openImport(format: "json" | "binary") {
    closeMenus();
    (format === "json" ? jsonFileRef : binaryFileRef).current?.click();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>, format: "json" | "binary") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imported = format === "json" ? parseProfileJsonText(new TextDecoder().decode(bytes)) : parseProfile(bytes);
      addStoredProfile(imported, t(`${file.name}を新しいプロファイルとして読み込みました`, `Opened ${file.name} as a new profile`));
    } catch (error) { setNotice(errorMessage(error, "読み込めませんでした", "Could not open the profile")); }
    event.target.value = "";
  }

  function addSequence() {
    if (profile.sequences.length >= 64) return;
    const used = new Set(profile.sequences.map((s) => s.id));
    let id = 0; while (used.has(id)) id++;
    update((draft) => draft.sequences.push({ id, name: `Macro ${id + 1}`, loopStart: 0, steps: [{ mask: 0, frames: 1 }] }));
    setSelectedSequence(profile.sequences.length); setNotice(t("新しいマクロを追加しました", "Added a new macro"));
  }

  function duplicateSequence() {
    if (!seq) return;
    if (profile.sequences.length >= 64) { setNotice(t("マクロは64件までです", "A profile can contain up to 64 macros")); return; }
    const sourceBindings = bindingsFor(profile, seq.id);
    if (profile.sequenceBindings.length + sourceBindings.length > MAX_SEQUENCE_BINDINGS) { setNotice(t(`マクロ割り当ては${MAX_SEQUENCE_BINDINGS}件までです`, `A profile can contain up to ${MAX_SEQUENCE_BINDINGS} macro assignments`)); return; }
    const used = new Set(profile.sequences.map((s) => s.id));
    let id = 0; while (used.has(id)) id++;
    update((draft) => {
      const source = draft.sequences[selectedSequence];
      draft.sequences.push({ ...clone(source), id, name: `${source.name} ${t("コピー", "Copy")}` });
      draft.sequenceBindings.push(...draft.sequenceBindings.filter((binding) => binding.sequenceId === source.id).map((binding) => ({ ...binding, sequenceId: id })));
    });
    setSelectedSequence(profile.sequences.length);
    setNotice(t("マクロと入力割り当てを複製しました", "Duplicated the macro and its assignments"));
  }

  function addSelector() {
    if (profile.selectors.length >= 8) return;
    const used = new Set(profile.selectors.map((s) => s.id));
    let id = 0; while (used.has(id)) id++;
    update((draft) => draft.selectors.push({ id, name: `Selector ${id + 1}`, increment: 13, decrement: 14, min: 0, max: 1, initial: 0, wrap: false, neutralFrames: 1, outputs: [0, 0], stateNames: ["0", "1"] }));
    setSelectedSelector(profile.selectors.length); setNotice(t("新しいセレクタを追加しました", "Added a new selector"));
  }

  function resetProfile() {
    if (!window.confirm(t("現在のプロファイルを初期化しますか？", "Reset the current profile?"))) return;
    const defaultProfile = createDefaultProfile();
    profileRef.current = defaultProfile;
    setProfile(defaultProfile);
    setSelectedSequence(0); setSelectedSelector(0); setSelectedMacroSet(0); setTab("mapping");
    setNotice(t("プロファイルを初期化しました", "Profile reset"));
    closeMenus();
  }

  function createProfile() { addStoredProfile(createDefaultProfile(), t("新しいプロファイルを作成しました", "Created a new profile")); }

  function duplicateProfile() {
    const copied = clone(profile); copied.name = `${profile.name} ${t("コピー", "Copy")}`;
    addStoredProfile(copied, t("プロファイルを複製しました", "Duplicated the profile"));
  }

  async function deleteProfile() {
    if (!window.confirm(t(`「${profile.name}」をブラウザから削除しますか？`, `Delete “${profile.name}” from this browser?`))) return;
    const remaining = storedProfiles.filter((entry) => entry.id !== activeProfileId);
    await removeStoredProfile(activeProfileId).catch(() => undefined);
    if (remaining.length) { setStoredProfiles(remaining); activateProfile(remaining[0]); }
    else {
      const blank = { id: newProfileId(), profile: createDefaultProfile(), updatedAt: Date.now() };
      setStoredProfiles([blank]); activateProfile(blank); void saveStoredProfile(blank);
    }
    setNotice(t("プロファイルを削除しました", "Profile deleted"));
  }

  function addMacroSet() {
    if (profile.macroSets.names.length >= 16) { setNotice(t("マクロセットは16件までです", "A profile can contain up to 16 macro sets")); return; }
    const next = profile.macroSets.names.length;
    update((draft) => draft.macroSets.names.push(`Set ${next}`));
    setSelectedMacroSet(next); setNotice(t(`Set ${next}を追加しました`, `Added Set ${next}`));
  }

  function removeMacroSet(index: number) {
    if (profile.macroSets.names.length === 1) return;
    if (!window.confirm(t(`「${profile.macroSets.names[index]}」を削除しますか？`, `Delete “${profile.macroSets.names[index]}”?`))) return;
    update((draft) => {
      draft.macroSets.names.splice(index, 1);
      draft.sequenceBindings = draft.sequenceBindings.filter((binding) => binding.setId !== index).map((binding) => binding.setId > index ? { ...binding, setId: binding.setId - 1 } : binding);
    });
    setSelectedMacroSet((current) => current > index ? current - 1 : Math.min(current, profile.macroSets.names.length - 2));
    setNotice(t("マクロセットを削除しました", "Macro set deleted"));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <Image className="brand-icon" src="/favicon.svg" alt="" width={30} height={30} priority />
          <h1>EASY ARCADE Macro Studio</h1>
        </div>
        <div className="header-actions">
          <input ref={jsonFileRef} type="file" accept=".eamacro.json,.json,application/vnd.easy-arcade.macro+json,application/json" hidden onChange={(event) => void importFile(event, "json")} />
          <input ref={binaryFileRef} type="file" accept=".eamacro,application/vnd.easy-arcade.macro" hidden onChange={(event) => void importFile(event, "binary")} />
          <LanguageSwitch />
          <Link className="help-link" href="/help" title={t("ヘルプ", "Help")} aria-label={t("ヘルプ", "Help")}>?</Link>
          <details className="file-menu" ref={fileMenuRef}>
            <summary className="file-action" title={t("ファイル操作", "File actions")} aria-label={t("ファイル操作", "File actions")}><span className="file-menu-icon" aria-hidden="true"><i /><i /><i /></span></summary>
            <div className="file-menu-popover">
              <button type="button" onClick={() => openImport("json")}><span>{t("JSONインポート", "Import JSON")}</span><small>.eamacro.json</small></button>
              <button type="button" onClick={saveAsJson} disabled={errors.length > 0}><span>{t("JSONエクスポート", "Export JSON")}</span><small>.eamacro.json</small></button>
              <div className="file-menu-divider" />
              <button type="button" onClick={() => openImport("binary")}><span>{t("バイナリインポート", "Import binary")}</span><small>.eamacro</small></button>
              <button type="button" onClick={saveAsMacro} disabled={errors.length > 0}><span>{t("バイナリエクスポート", "Export binary")}</span><small>.eamacro</small></button>
            </div>
          </details>
        </div>
      </header>

      <section className="profile-strip">
        <div className="profile-primary-row">
          <details className="profile-picker" ref={profileMenuRef}>
            <summary aria-label={t("プロファイルを選択", "Select profile")}>Profile</summary>
            <div className="profile-popover">
              <div className="profile-list" role="listbox" aria-label={t("保存済みプロファイル", "Saved profiles")}>{storedProfiles.map((entry) => <button role="option" aria-selected={entry.id === activeProfileId} className={entry.id === activeProfileId ? "active" : ""} onClick={() => activateProfile(entry)} key={entry.id}><span>{entry.profile.name}</span>{entry.id === activeProfileId && <b>✓</b>}</button>)}</div>
            </div>
          </details>
          <input className="profile-name" aria-label={t("プロファイル名", "Profile name")} value={profile.name} onChange={(e) => update((d) => { d.name = e.target.value; })} />
          <div className="profile-row-actions">
            <button onClick={createProfile}>{t("新規", "New")}</button>
            <button onClick={duplicateProfile}>{t("複製", "Duplicate")}</button>
            <button onClick={resetProfile}>{t("初期化", "Reset")}</button>
            <button className="danger" onClick={deleteProfile}>{t("削除", "Delete")}</button>
          </div>
        </div>
        <div className="profile-settings-row">
          <details className="frame-step-setting" ref={frameStepMenuRef}>
            <summary aria-label={t("1 tickあたりのフレーム数を設定", "Set frames per tick")}>1 tick = {profile.frameStep} {t("フレーム", profile.frameStep === 1 ? "frame" : "frames")}<span aria-hidden="true">⌄</span></summary>
            <div className="frame-step-popover">
              <label><span>{t("1 tickあたり", "Frames per tick")}</span><div><input aria-label={t("1 tickあたりのフレーム数", "Frames per tick")} type="number" min="1" max="255" value={profile.frameStep} onChange={(event) => update((draft) => { draft.frameStep = Math.max(1, Math.min(255, Number(event.target.value))); })} /><span>{t("フレーム", profile.frameStep === 1 ? "frame" : "frames")}</span></div></label>
            </div>
          </details>
          <label className="profile-check"><input type="checkbox" checked={profile.twoPlayerOutputs} onChange={(event) => update((draft) => {
            draft.twoPlayerOutputs = event.target.checked;
            if (!event.target.checked) {
              draft.mappings = draft.mappings.map((mask) => mask & 0x0fff);
              draft.sequences.forEach((sequence) => sequence.steps.forEach((step) => { step.mask &= 0x0fff; }));
              draft.selectors.forEach((item) => { item.outputs = item.outputs.map((mask) => mask & 0x0fff); });
            }
          })} /><span>2P</span></label>
        </div>
      </section>

      <nav className="tabs" aria-label={t("編集カテゴリ", "Editor sections")}>
        <button className={tab === "mapping" ? "active" : ""} onClick={() => setTab("mapping")}>{t("ボタン設定", "Button Mapping")}</button>
        <button className={tab === "macro" ? "active" : ""} onClick={() => setTab("macro")}>{t("マクロ", "Macros")}</button>
        <button className={tab === "macrosets" ? "active" : ""} onClick={() => setTab("macrosets")}>{t("マクロセット", "Macro Sets")}</button>
        <button className={tab === "selector" ? "active" : ""} onClick={() => setTab("selector")}>{t("ステートセレクタ", "State Selectors")}</button>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>{t("割り当て一覧", "Assignments")}</button>
        <button className={tab === "share" ? "active" : ""} onClick={() => setTab("share")}>{t("共有", "Share")}</button>
      </nav>

      {tab === "mapping" && (
        <section className="workspace mapping-workspace">
          <div className="section-heading"><div><h2>{t("ボタン設定", "Button Mapping")}</h2></div><p>{t("連射を上書きしない場合は本体設定を使用します。", "Rapid fire inherits the hardware setting unless overridden.")}</p></div>
          <div className="routing-head button-head"><span>{t("論理ボタン", "Logical button")}</span><span>{t("出力", "Output")}</span><span>{t("連射", "Rapid fire")}</span></div>
          <div className="mapping-grid">
            {EDITOR_LOGICAL_BUTTONS.map((button, index) => (
              <article className="mapping-row button-row" key={button}>
                <div className="logical-label"><strong>{buttonLabel(button)}</strong></div>
                <div className="direct-route"><OutputToggles twoPlayerOutputs={profile.twoPlayerOutputs} mask={profile.mappings[index]} onChange={(mask) => update((d) => { d.mappings[index] = mask; })} /></div>
                <div className="rapid-route">
                  <label className="override-check" title={t("本体の連射設定を上書き", "Override hardware rapid fire")}><input aria-label={t(`${button}の連射設定を上書き`, `Override rapid fire for ${button}`)} type="checkbox" checked={profile.rapidFire[index].override} onChange={(e) => update((d) => { d.rapidFire[index].override = e.target.checked; })} /></label>
                  {profile.rapidFire[index].override && <div className="rapid-options"><select aria-label={t(`${button}の連射方式`, `Rapid-fire mode for ${button}`)} value={profile.rapidFire[index].triggerType} onChange={(e) => update((d) => { d.rapidFire[index].triggerType = e.target.value as "disabled" | "sync" | "front" | "back"; })}><option value="disabled">{t("連射無効", "Disabled")}</option><option value="sync">{t("同期", "Sync")}</option><option value="front">{t("表", "Front")}</option><option value="back">{t("裏", "Back")}</option></select><label className="rapid-divisor"><span>1/</span><input aria-label={t(`${button}の連射分周比`, `Rapid-fire divisor for ${button}`)} type="number" min="2" max="60" disabled={profile.rapidFire[index].triggerType === "disabled"} value={profile.rapidFire[index].divisor} onChange={(e) => update((d) => { d.rapidFire[index].divisor = Math.max(2, Math.min(60, Number(e.target.value))); })} /></label></div>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "macro" && (
        <section className="workspace macro-workspace">
          <MacroSetBar names={profile.macroSets.names} selected={selectedMacroSet} onChange={setSelectedMacroSet} />
          <div className="split-workspace">
            <aside className="rail">
              <div className="rail-title"><h2>{t("マクロ", "Macros")}</h2><button onClick={addSequence} aria-label={t("マクロを追加", "Add macro")}>＋</button></div>
              <div className="rail-list">
                {profile.sequences.map((item, index) => {
                  const count = bindingsFor(profile, item.id).filter((binding) => binding.setId === selectedMacroSet && binding.logicalId < EDITOR_LOGICAL_BUTTONS.length).length;
                  return <button key={item.id} className={index === selectedSequence ? "rail-card active" : "rail-card"} onClick={() => setSelectedSequence(index)}>
                    <strong>{item.name}</strong><small>{count ? t(`${count}入力`, `${count} ${count === 1 ? "input" : "inputs"}`) : t("未割り当て", "Unassigned")} · {item.steps.reduce((n, s) => n + s.frames, 0) * profile.frameStep} {t("フレーム", "frames")}</small>
                  </button>;
                })}
              </div>
            </aside>
            {seq ? <SequenceEditor key={seq.id} sequence={seq} frameStep={profile.frameStep} twoPlayerOutputs={profile.twoPlayerOutputs} bindings={bindingsFor(profile, seq.id).filter((binding) => binding.setId === selectedMacroSet && binding.logicalId < EDITOR_LOGICAL_BUTTONS.length)} updateSequence={(mutator) => update((d) => mutator(d.sequences[selectedSequence]))} timelineClipboard={timelineClipboard} setTimelineClipboard={setTimelineClipboard}
              toggleTrigger={(logicalId) => update((d) => {
                const found = d.sequenceBindings.findIndex((b) => b.sequenceId === seq.id && b.logicalId === logicalId && b.setId === selectedMacroSet);
                if (found >= 0) d.sequenceBindings.splice(found, 1);
                else d.sequenceBindings.push({ logicalId, sequenceId: seq.id, setId: selectedMacroSet, loop: false, cancelOnRelease: false, transform: "none" });
              })}
              setBindingMode={(field, value) => update((d) => d.sequenceBindings.filter((b) => b.sequenceId === seq.id && b.setId === selectedMacroSet && b.logicalId < EDITOR_LOGICAL_BUTTONS.length).forEach((b) => { b[field] = value; }))}
              setBindingTransform={(logicalId, transform) => update((d) => { const binding = d.sequenceBindings.find((b) => b.sequenceId === seq.id && b.logicalId === logicalId && b.setId === selectedMacroSet); if (binding) binding.transform = transform; })}
              duplicate={duplicateSequence}
              remove={() => { update((d) => { const removedId = d.sequences[selectedSequence].id; d.sequences.splice(selectedSequence, 1); d.sequenceBindings = d.sequenceBindings.filter((binding) => binding.sequenceId !== removedId); }); setSelectedSequence(0); }} /> : <EmptyState label={t("マクロがありません", "No macros yet")} action={t("＋ 最初のマクロを作る", "+ Create the first macro")} onClick={addSequence} />}
          </div>
        </section>
      )}

      {tab === "macrosets" && <MacroSetEditor profile={profile} update={update} add={addMacroSet} remove={removeMacroSet} />}

      {tab === "selector" && (
        <section className="workspace split-workspace">
          <aside className="rail">
            <div className="rail-title"><h2>{t("セレクタ", "Selectors")}</h2><button onClick={addSelector}>＋</button></div>
            <div className="rail-list">
              {profile.selectors.map((item, index) => (
                <button key={item.id} className={index === selectedSelector ? "rail-card active" : "rail-card"} onClick={() => setSelectedSelector(index)}>
                  <strong>{item.name}</strong><small>{item.min}–{item.max} · {item.wrap ? t("循環", "Wrap") : t("端で停止", "Stop at ends")}</small>
                </button>
              ))}
            </div>
          </aside>
          {selector ? <SelectorEditor selector={selector} twoPlayerOutputs={profile.twoPlayerOutputs} update={(mutator) => update((d) => mutator(d.selectors[selectedSelector]))}
            remove={() => { update((d) => d.selectors.splice(selectedSelector, 1)); setSelectedSelector(0); }} /> : <EmptyState label={t("セレクタがありません", "No selectors yet")} action={t("＋ 最初のセレクタを作る", "+ Create the first selector")} onClick={addSelector} />}
        </section>
      )}

      {tab === "overview" && <AssignmentOverview profile={profile} selectedMacroSet={selectedMacroSet} setSelectedMacroSet={setSelectedMacroSet} />}

      {tab === "share" && <SharedProfiles profile={profile} onImport={(imported, message) => { addStoredProfile(imported, message); showNotice(message); }} onNotice={showNotice} />}

      {toast && <div className="app-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>}

      <footer className="footerbar"><span className={errors.length ? "notice error" : "notice"}>{errors[0] || notice}</span></footer>
    </main>
  );
}

function MacroSetBar({ names, selected, onChange, label }: { names: string[]; selected: number; onChange: (value: number) => void; label?: string }) {
  const { t } = useI18n();
  return <div className="macro-set-bar"><span>{label ?? t("セット", "Set")}</span><select aria-label={t("編集するマクロセット", "Macro set to edit")} value={selected} onChange={(event) => onChange(Number(event.target.value))}>{names.map((name, index) => <option value={index} key={index}>{index} · {name}</option>)}</select></div>;
}

function MacroSetEditor({ profile, update, add, remove }: { profile: Profile; update: (fn: (draft: Profile) => void) => void; add: () => void; remove: (index: number) => void }) {
  const { t } = useI18n();
  const config = profile.macroSets;
  return (
    <section className="workspace macro-set-workspace">
      <div className="section-heading"><div><h2>{t("マクロセット", "Macro Sets")}</h2></div><button className="button" disabled={config.names.length >= 16} onClick={add}>＋ {t("追加", "Add")}</button></div>
      <div className="macro-set-table">
        <div className="macro-set-head"><span>Set ID</span><span>{t("名前", "Name")}</span><span /></div>
        {config.names.map((name, index) => <div className="macro-set-row" key={index}><strong>{index}</strong><input aria-label={t(`Set ${index}の名前`, `Name of Set ${index}`)} value={name} onChange={(event) => update((draft) => { draft.macroSets.names[index] = event.target.value; })} /><button disabled={config.names.length === 1} onClick={() => remove(index)}>{t("削除", "Delete")}</button></div>)}
      </div>
    </section>
  );
}

function SequenceEditor({ sequence, frameStep, twoPlayerOutputs, bindings, updateSequence, timelineClipboard, setTimelineClipboard, toggleTrigger, setBindingMode, setBindingTransform, duplicate, remove }: {
  sequence: MacroSequence;
  frameStep: number;
  twoPlayerOutputs: boolean;
  bindings: SequenceBinding[];
  updateSequence: (fn: (s: MacroSequence) => void) => void;
  timelineClipboard: TickClipboard;
  setTimelineClipboard: (value: TickClipboard) => void;
  toggleTrigger: (logicalId: number) => void;
  setBindingMode: (field: "loop" | "cancelOnRelease", value: boolean) => void;
  setBindingTransform: (logicalId: number, transform: OutputTransform) => void;
  duplicate: () => void;
  remove: () => void;
}) {
  const { t } = useI18n();
  const [editorMode, setEditorMode] = useState<"steps" | "grid">("steps");
  const total = totalTicks(sequence);
  const loopValue = bindings.length && bindings.every((b) => b.loop) ? "loop" : bindings.some((b) => b.loop) ? "mixed" : "once";
  const releaseValue = bindings.length && bindings.every((b) => b.cancelOnRelease) ? "cancel" : bindings.some((b) => b.cancelOnRelease) ? "mixed" : "complete";
  function toggleTransformAxis(binding: SequenceBinding, axis: "horizontal" | "vertical") {
    const current = transformAxes(binding.transform);
    setBindingTransform(binding.logicalId, transformFromAxes(axis === "horizontal" ? !current.horizontal : current.horizontal, axis === "vertical" ? !current.vertical : current.vertical));
  }
  return (
    <div className="editor-panel">
      <div className="editor-titleline">
        <input className="title-input" aria-label={t("マクロ名", "Macro name")} value={sequence.name} onChange={(e) => updateSequence((s) => { s.name = e.target.value; })} />
        <div className="editor-title-actions"><button onClick={duplicate}>{t("複製", "Duplicate")}</button><button onClick={remove}>{t("削除", "Delete")}</button></div>
      </div>
      <div className="macro-assignment-panel">
        <div className="trigger-heading"><h3>{t("起動ボタン", "Trigger Buttons")}</h3><small>{t("↔ / ↕ で出力方向を反転", "Use ↔ / ↕ to mirror the output")}</small></div>
        <div className="trigger-buttons">{EDITOR_LOGICAL_BUTTONS.map((button, logicalId) => {
          const binding = bindings.find((item) => item.logicalId === logicalId);
          const axes = transformAxes(binding?.transform ?? "none");
          return <div className={binding ? "trigger-card active" : "trigger-card"} key={button}>
            <button className="trigger-main" aria-pressed={!!binding} onClick={() => toggleTrigger(logicalId)}>{buttonLabel(button)}</button>
            <div className="flip-flags"><button disabled={!binding} className={axes.horizontal ? "active" : ""} aria-label={t(`${button}の左右反転`, `Mirror ${button} horizontally`)} aria-pressed={axes.horizontal} onClick={() => binding && toggleTransformAxis(binding, "horizontal")}>↔</button><button disabled={!binding} className={axes.vertical ? "active" : ""} aria-label={t(`${button}の上下反転`, `Mirror ${button} vertically`)} aria-pressed={axes.vertical} onClick={() => binding && toggleTransformAxis(binding, "vertical")}>↕</button></div>
          </div>;
        })}</div>
      </div>
      <div className="behavior-strip macro-behavior">
        <label className="control"><span>{t("再生", "Playback")}</span><select disabled={!bindings.length} value={loopValue} onChange={(e) => setBindingMode("loop", e.target.value === "loop")}><option value="once">{t("1回再生", "Play once")}</option><option value="loop">{t("押している間反復", "Repeat while held")}</option>{loopValue === "mixed" && <option value="mixed">{t("入力ごとに異なる", "Varies by input")}</option>}</select></label>
        <label className="control"><span>{t("離したとき", "On release")}</span><select disabled={!bindings.length} value={releaseValue} onChange={(e) => setBindingMode("cancelOnRelease", e.target.value === "cancel")}><option value="complete">{t("現在の再生を完了", "Finish playback")}</option><option value="cancel">{t("すぐに中断", "Stop immediately")}</option>{releaseValue === "mixed" && <option value="mixed">{t("入力ごとに異なる", "Varies by input")}</option>}</select></label>
        <label className="control loop-start-control"><span>{t("ループ開始ステップ", "Loop start step")}</span><IntegerInput key={`loop-${sequence.loopStart}-${sequence.steps.length}`} ariaLabel={t("ループ開始ステップ", "Loop start step")} value={sequence.loopStart + 1} min={1} max={sequence.steps.length} onCommit={(value) => updateSequence((s) => { s.loopStart = value - 1; })} /></label>
      </div>
      <div className="sequence-summary" aria-label={t("シーケンス", "Sequence")}>{sequence.steps.map((step, index) => <div className="sequence-summary-item" key={index}><span className="sequence-command">{commandLabel(step.mask, twoPlayerOutputs)}</span>{step.frames > 1 && <small>×{step.frames}</small>}{index < sequence.steps.length - 1 && <b aria-hidden="true">›</b>}</div>)}</div>
      <div className="editor-toolbar"><span>{sequence.steps.length} {t("ステップ", "steps")} · {total} tick · {total * frameStep} {t("フレーム", "frames")}</span><div className="editor-mode"><button className={editorMode === "steps" ? "active" : ""} onClick={() => setEditorMode("steps")}>{t("ステップ", "Steps")}</button><button className={editorMode === "grid" ? "active" : ""} onClick={() => setEditorMode("grid")}>{t("タイムライン", "Timeline")}</button></div></div>
      {editorMode === "steps" ? <><div className="steps-list"><div className="steps-head"><span>#</span><span>{t("出力", "Output")}</span><span>tick</span><span /></div>
        {sequence.steps.map((step, index) => (
          <div className="step-group" key={index}>
            <button className="insert-step" disabled={sequence.steps.length >= 255} onClick={() => updateSequence((s) => { s.steps.splice(index, 0, { mask: 0, frames: 1 }); if (s.loopStart >= index) s.loopStart++; })}>＋ {index === 0 ? t("先頭に挿入", "Insert at start") : t("ここに挿入", "Insert here")}</button>
            <article className="step-row">
              <div className="step-index">{index + 1}</div>
              <div className="step-output"><OutputToggles twoPlayerOutputs={twoPlayerOutputs} mask={step.mask} onChange={(mask) => updateSequence((s) => { s.steps[index].mask = mask; })} /></div>
              <div className="duration"><IntegerInput key={step.frames} ariaLabel={t(`ステップ${index + 1}のtick数`, `Ticks in step ${index + 1}`)} value={step.frames} min={1} max={65535} onCommit={(value) => updateSequence((s) => { s.steps[index].frames = value; })} /></div>
              <button className="remove-step" disabled={sequence.steps.length === 1} onClick={() => updateSequence((s) => { const oldLoop = s.loopStart; s.steps.splice(index, 1); s.loopStart = oldLoop > index ? oldLoop - 1 : oldLoop === index ? Math.min(index, s.steps.length - 1) : oldLoop; })}>×</button>
            </article>
          </div>
        ))}
      </div><button className="add-row" disabled={sequence.steps.length >= 255} onClick={() => updateSequence((s) => { s.steps.push({ mask: 0, frames: 1 }); })}>＋ {t("末尾にステップを追加", "Add step at end")}</button></> : <TimelineEditor sequence={sequence} twoPlayerOutputs={twoPlayerOutputs} updateSequence={updateSequence} clipboard={timelineClipboard} setClipboard={setTimelineClipboard} />}
    </div>
  );
}

function TimelineEditor({ sequence, twoPlayerOutputs, updateSequence, clipboard, setClipboard }: { sequence: MacroSequence; twoPlayerOutputs: boolean; updateSequence: (fn: (s: MacroSequence) => void) => void; clipboard: TickClipboard; setClipboard: (value: TickClipboard) => void }) {
  const { t } = useI18n();
  const PAGE_SIZE = 64;
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState({ anchor: 0, focus: 0 });
  const [editStatus, setEditStatus] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const undoStack = useRef<MacroSequence[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const total = totalTicks(sequence);
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const safePage = Math.min(page, maxPage);
  const start = safePage * PAGE_SIZE;
  const count = Math.min(PAGE_SIZE, total - start);
  const ticks = Array.from({ length: count }, (_, index) => start + index);
  const selected = Math.min(selection.focus, total - 1);
  const rangeStart = Math.max(0, Math.min(selection.anchor, selected));
  const rangeEnd = Math.max(selection.anchor, selected);
  const selectedCount = rangeEnd - rangeStart + 1;
  const clipboardTicks = clipboard.reduce((sum, step) => sum + step.frames, 0);

  function selectTick(tick: number, extend = false) {
    setSelection((current) => ({ anchor: extend ? Math.min(current.anchor, total - 1) : tick, focus: tick }));
  }
  function goToPage(next: number) { setPage(Math.max(0, Math.min(maxPage, next))); }
  function edit(mutator: (s: MacroSequence) => void) {
    undoStack.current = [...undoStack.current.slice(-99), clone(sequence)];
    setCanUndo(true);
    updateSequence(mutator);
  }
  function copySelection() {
    setClipboard(copyTickRange(sequence, rangeStart, rangeEnd));
    setEditStatus(t(`${selectedCount} tickをコピーしました`, `Copied ${selectedCount} ${selectedCount === 1 ? "tick" : "ticks"}`));
  }
  function deleteSelection() {
    edit((s) => replaceTickRange(s, rangeStart, rangeEnd, []));
    const next = Math.min(rangeStart, total - selectedCount - 1);
    setSelection({ anchor: Math.max(0, next), focus: Math.max(0, next) });
    setEditStatus(t(`${selectedCount} tickを削除しました`, `Deleted ${selectedCount} ${selectedCount === 1 ? "tick" : "ticks"}`));
  }
  function cutSelection() {
    setClipboard(copyTickRange(sequence, rangeStart, rangeEnd));
    edit((s) => replaceTickRange(s, rangeStart, rangeEnd, []));
    const next = Math.max(0, Math.min(rangeStart, total - selectedCount - 1));
    setSelection({ anchor: next, focus: next });
    setEditStatus(t(`${selectedCount} tickをカットしました`, `Cut ${selectedCount} ${selectedCount === 1 ? "tick" : "ticks"}`));
  }
  function pasteSelection() {
    if (!clipboardTicks) return;
    edit((s) => insertTickRange(s, rangeStart, clipboard));
    const end = rangeStart + clipboardTicks - 1;
    setSelection({ anchor: rangeStart, focus: end });
    setPage(Math.floor(rangeStart / PAGE_SIZE));
    setEditStatus(t(`${clipboardTicks} tickを選択位置へ挿入しました`, `Inserted ${clipboardTicks} ${clipboardTicks === 1 ? "tick" : "ticks"} at the selection`));
  }
  function undo() {
    const previous = undoStack.current.at(-1);
    if (!previous) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setCanUndo(undoStack.current.length > 0);
    updateSequence((s) => Object.assign(s, clone(previous)));
    const tick = Math.min(rangeStart, totalTicks(previous) - 1);
    setSelection({ anchor: tick, focus: tick });
    setPage(Math.floor(tick / PAGE_SIZE));
    setEditStatus(t("直前の編集を元に戻しました", "Undid the last edit"));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!editorRef.current?.contains(document.activeElement) || target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (command && key === "c") copySelection();
      else if (command && key === "x") cutSelection();
      else if (command && key === "v") pasteSelection();
      else if (command && key === "z" && !event.shiftKey) undo();
      else if (command && key === "a") { setSelection({ anchor: 0, focus: total - 1 }); setPage(0); }
      else if (event.key === "Delete" || event.key === "Backspace") deleteSelection();
      else return;
      event.preventDefault();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="piano-editor" ref={editorRef}>
      <div className={maxPage > 0 ? "piano-toolbar" : "piano-toolbar single-page"}>
        {maxPage > 0 && <div><button disabled={safePage === 0} onClick={() => goToPage(safePage - 1)}>←</button><strong>{start + 1}–{start + count}</strong><button disabled={safePage === maxPage} onClick={() => goToPage(safePage + 1)}>→</button><span>{safePage + 1} / {maxPage + 1}</span></div>}
        <div className="frame-tools"><span>{rangeStart === rangeEnd ? `tick ${rangeStart + 1}` : `tick ${rangeStart + 1}–${rangeEnd + 1} (${selectedCount})`}</span><button onClick={() => { edit((s) => insertTick(s, rangeStart)); setSelection({ anchor: rangeStart, focus: rangeStart }); }}>{t("前に追加", "Add before")}</button><button onClick={() => { edit((s) => insertTick(s, rangeEnd + 1)); const tick = rangeEnd + 1; setSelection({ anchor: tick, focus: tick }); }}>{t("後に追加", "Add after")}</button></div>
      </div>
      <div className="piano-editbar">
        <span>{t("クリックで選択、Shift＋クリックで範囲選択", "Click to select; Shift-click to select a range")}</span>
        <div><button disabled={!canUndo} onClick={undo} title={t("元に戻す (⌘/Ctrl+Z)", "Undo (⌘/Ctrl+Z)")}>{t("元に戻す", "Undo")}</button><button onClick={copySelection} title={t("コピー (⌘/Ctrl+C)", "Copy (⌘/Ctrl+C)")}>{t("コピー", "Copy")}</button><button onClick={cutSelection} title={t("カット (⌘/Ctrl+X)", "Cut (⌘/Ctrl+X)")}>{t("カット", "Cut")}</button><button disabled={!clipboardTicks} onClick={pasteSelection} title={t("選択範囲の先頭へ挿入 (⌘/Ctrl+V)", "Insert at selection start (⌘/Ctrl+V)")}>{t("ペースト", "Paste")}</button><button className="danger" disabled={total <= 1 && selectedCount === 1} onClick={deleteSelection} title={t("削除 (Delete)", "Delete (Delete)")}>{t("削除", "Delete")}</button></div>
      </div>
      <div className="piano-scroll">
        <div className="piano-grid" style={{ gridTemplateColumns: `76px repeat(${count}, 27px)` }}>
          <div className="piano-corner">{t("出力", "Output")}</div>
          {ticks.map((tick) => { const inRange = tick >= rangeStart && tick <= rangeEnd; return <button key={`h${tick}`} aria-pressed={inRange} className={inRange ? "frame-head selected" : "frame-head"} onClick={(event) => selectTick(tick, event.shiftKey)}>{tick + 1}</button>; })}
          {OUTPUTS.slice(0, twoPlayerOutputs ? 24 : 12).map((output, outputIndex) => <div className="piano-row" key={output} style={{ display: "contents" }}><div className="piano-label">{outputLabel(outputIndex, twoPlayerOutputs)}</div>{ticks.map((tick) => { const active = !!(maskAtTick(sequence, tick) & (1 << outputIndex)); const inRange = tick >= rangeStart && tick <= rangeEnd; return <button aria-label={t(`${tick + 1} tickの${output}`, `${output} at tick ${tick + 1}`)} key={`${output}-${tick}`} className={`${active ? "note active" : "note"}${inRange ? " selected" : ""}`} onClick={(event) => { selectTick(tick, event.shiftKey); if (!event.shiftKey) edit((s) => setTickMask(s, tick, maskAtTick(s, tick) ^ (1 << outputIndex))); }}><i /></button>; })}</div>)}
        </div>
      </div>
      <div className="piano-footer"><span aria-live="polite">{editStatus}</span><button onClick={() => { edit((s) => insertTick(s, total)); setSelection({ anchor: total, focus: total }); setPage(Math.floor(total / PAGE_SIZE)); }}>{t("末尾に追加", "Add at end")}</button></div>
    </div>
  );
}

function SelectorEditor({ selector, twoPlayerOutputs, update, remove }: { selector: StateSelector; twoPlayerOutputs: boolean; update: (fn: (s: StateSelector) => void) => void; remove: () => void }) {
  const { t } = useI18n();
  function setMax(max: number) {
    update((s) => {
      s.max = Math.max(s.min, Math.min(s.min + 63, max));
      const count = s.max - s.min + 1;
      s.outputs = [...s.outputs.slice(0, count), ...Array(Math.max(0, count - s.outputs.length)).fill(0)];
      s.stateNames = Array.from({ length: count }, (_, index) => s.stateNames[index] ?? String(s.min + index));
      s.initial = Math.min(s.initial, s.max);
    });
  }
  return (
    <div className="editor-panel">
      <div className="editor-titleline"><input className="title-input" aria-label={t("セレクタ名", "Selector name")} value={selector.name} onChange={(e) => update((s) => { s.name = e.target.value; })} /><div className="editor-title-actions"><button onClick={remove}>{t("削除", "Delete")}</button></div></div>
      <div className="control-grid six">
        <label className="control"><span>{t("増加", "Increment")}</span><select value={selector.increment} onChange={(e) => update((s) => { s.increment = Number(e.target.value); })}>{selector.increment >= EDITOR_LOGICAL_BUTTONS.length && <option value={selector.increment}>{t(`ID ${selector.increment}（非表示）`, `ID ${selector.increment} (hidden)`)}</option>}{EDITOR_LOGICAL_BUTTONS.map((b, i) => <option value={i} key={b}>{buttonLabel(b)}</option>)}</select></label>
        <label className="control"><span>{t("減少", "Decrement")}</span><select value={selector.decrement} onChange={(e) => update((s) => { s.decrement = Number(e.target.value); })}>{selector.decrement >= EDITOR_LOGICAL_BUTTONS.length && <option value={selector.decrement}>{t(`ID ${selector.decrement}（非表示）`, `ID ${selector.decrement} (hidden)`)}</option>}{EDITOR_LOGICAL_BUTTONS.map((b, i) => <option value={i} key={b}>{buttonLabel(b)}</option>)}</select></label>
        <label className="control"><span>{t("最大値", "Maximum")}</span><input type="number" min={selector.min} max={selector.min + 63} value={selector.max} onChange={(e) => setMax(Number(e.target.value))} /></label>
        <label className="control"><span>{t("初期値", "Initial")}</span><input type="number" min={selector.min} max={selector.max} value={selector.initial} onChange={(e) => update((s) => { s.initial = Number(e.target.value); })} /></label>
        <label className="control"><span>{t("端の動作", "At limits")}</span><select value={selector.wrap ? "wrap" : "clamp"} onChange={(e) => update((s) => { s.wrap = e.target.value === "wrap"; })}><option value="clamp">{t("停止", "Stop")}</option><option value="wrap">{t("循環", "Wrap")}</option></select></label>
        <label className="control"><span>{t("無出力フレーム", "Neutral frames")}</span><input type="number" min="0" max="255" value={selector.neutralFrames} onChange={(e) => update((s) => { s.neutralFrames = Number(e.target.value); })} /></label>
      </div>
      <div className="state-table"><div className="state-table-head"><span>{t("状態", "State")}</span><span>{t("名前", "Name")}</span><span>{t("出力", "Output")}</span></div>{selector.outputs.map((mask, index) => <div className="state-row" key={index}><strong>{selector.min + index}</strong><input className="state-name-input" aria-label={t(`状態${selector.min + index}の名前`, `Name of state ${selector.min + index}`)} value={selector.stateNames[index]} onChange={(event) => update((s) => { s.stateNames[index] = event.target.value; })} /><OutputToggles twoPlayerOutputs={twoPlayerOutputs} mask={mask} onChange={(value) => update((s) => { s.outputs[index] = value; })} /></div>)}</div>
    </div>
  );
}

function AssignmentOverview({ profile, selectedMacroSet, setSelectedMacroSet }: { profile: Profile; selectedMacroSet: number; setSelectedMacroSet: (value: number) => void }) {
  const { locale, t } = useI18n();
  const rapidLabels = { disabled: t("連射無効", "Disabled"), sync: t("同期", "Sync"), front: t("表", "Front"), back: t("裏", "Back") } as const;
  const transformLabels: Record<OutputTransform, string> = { none: "", flipHorizontal: t("左右反転", "Horizontal mirror"), flipVertical: t("上下反転", "Vertical mirror"), flipBoth: t("上下左右反転", "Horizontal + vertical mirror") };
  return (
    <section className="workspace overview-workspace">
      <div className="section-heading"><div><h2>{t("割り当て一覧", "Assignment Overview")}</h2></div><MacroSetBar label={t("マクロセット", "Macro Set")} names={profile.macroSets.names} selected={selectedMacroSet} onChange={setSelectedMacroSet} /></div>
      <div className="overview-head"><span>{t("論理ボタン", "Logical button")}</span><span>{t("出力", "Output")}</span><span>{t("連射", "Rapid fire")}</span><span>{t("マクロ", "Macros")}</span><span>{t("セレクタ操作", "Selector control")}</span></div>
      <div className="overview-list">{EDITOR_LOGICAL_BUTTONS.map((button, logicalId) => {
        const macros = profile.sequenceBindings.filter((binding) => binding.logicalId === logicalId && binding.setId === selectedMacroSet).map((binding) => ({ binding, macro: profile.sequences.find((sequence) => sequence.id === binding.sequenceId) })).filter((item) => item.macro);
        const modifiers = profile.selectors.flatMap((selector) => [selector.increment === logicalId ? `${selector.name} ＋` : "", selector.decrement === logicalId ? `${selector.name} −` : ""]).filter(Boolean);
        const rapid = profile.rapidFire[logicalId];
        const rate = 60 / rapid.divisor;
        const rateLabel = `1/${rapid.divisor} (${Number.isInteger(rate) ? rate : rate.toFixed(1)}${locale === "ja" ? "連" : "/s"})`;
        return <article className="overview-row" key={button}><div className="overview-logical"><strong>{buttonLabel(button)}</strong></div><div className="tag-list">{maskLabels(profile.mappings[logicalId], profile.twoPlayerOutputs).map((output) => <span key={output.key}>{output.label}</span>)}{profile.mappings[logicalId] === 0 && <em>—</em>}</div><div className="overview-rapid">{!rapid.override ? t("本体設定", "Hardware setting") : rapid.triggerType === "disabled" ? t("連射無効", "Disabled") : `${rapidLabels[rapid.triggerType]} ${rateLabel}`}</div><div className="tag-list macro-tags">{macros.map(({ macro, binding }) => macro && <span key={macro.id}>{macro.name}{binding.transform !== "none" ? ` · ${transformLabels[binding.transform]}` : ""}</span>)}{macros.length === 0 && <em>—</em>}</div><div className="tag-list modifier-tags">{modifiers.map((label) => <span key={label}>{label}</span>)}{modifiers.length === 0 && <em>—</em>}</div></article>;
      })}</div>
    </section>
  );
}

function EmptyState({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><h2>{label}</h2><button className="button primary" onClick={onClick}>{action}</button></div>;
}
