"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  bindingsFor, compileProfile, createDefaultProfile, LOGICAL_BUTTONS, MacroSequence,
  MAX_SEQUENCE_BINDINGS, normalizeProfile, OUTPUTS, OutputTransform, parseProfile, Profile, SequenceBinding, StateSelector, validateProfile,
} from "./profile";
import { listStoredProfiles, removeStoredProfile, saveStoredProfile, StoredProfile } from "./profileStore";
import { deleteTick, insertTick, maskAtTick, setTickMask, totalTicks } from "./sequenceEditing";
import { SharedProfiles } from "./SharedProfiles";

type Tab = "mapping" | "macro" | "macrosets" | "selector" | "overview" | "share";

function clone<T>(value: T): T { return structuredClone(value); }
function maskLabels(mask: number) { return OUTPUTS.filter((_, i) => mask & (1 << i)); }
const RAPID_TYPE_LABELS = { disabled: "連射無効", sync: "同期", front: "表", back: "裏" } as const;
const TRANSFORM_LABELS: Record<OutputTransform, string> = { none: "", flipHorizontal: "左右反転", flipVertical: "上下反転", flipBoth: "上下左右反転" };
function rapidRate(divisor: number) { const rate = 60 / divisor; return `1/${divisor} (${Number.isInteger(rate) ? rate : rate.toFixed(1)}連)`; }
function transformAxes(transform: OutputTransform) { return { horizontal: transform === "flipHorizontal" || transform === "flipBoth", vertical: transform === "flipVertical" || transform === "flipBoth" }; }
function transformFromAxes(horizontal: boolean, vertical: boolean): OutputTransform { return horizontal && vertical ? "flipBoth" : horizontal ? "flipHorizontal" : vertical ? "flipVertical" : "none"; }
function newProfileId() { return crypto.randomUUID(); }
function profileFileName(name: string) { return `${name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "profile"}.eamacro`; }

type SaveFileHandle = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> };
type FilePickerWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveFileHandle> };

function OutputToggles({ mask, onChange, allowed = 0x0fff }: { mask: number; onChange: (mask: number) => void; allowed?: number }) {
  return (
    <div className="output-toggles">
      {OUTPUTS.map((label, index) => {
        const bit = 1 << index;
        const disabled = !(allowed & bit);
        return (
          <button key={label} type="button" disabled={disabled} className={mask & bit ? "output-chip active" : "output-chip"}
            onClick={() => onChange(mask ^ bit)}>{label}</button>
        );
      })}
    </div>
  );
}

export function MacroEditor() {
  const [profile, setProfile] = useState<Profile>(() => createDefaultProfile());
  const [tab, setTab] = useState<Tab>("mapping");
  const [selectedSequence, setSelectedSequence] = useState(0);
  const [selectedSelector, setSelectedSelector] = useState(0);
  const [selectedMacroSet, setSelectedMacroSet] = useState(0);
  const [notice, setNotice] = useState("新しいプロファイルを準備しました");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [storedProfiles, setStoredProfiles] = useState<StoredProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const toastTimerRef = useRef<number | null>(null);

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
        setStoredProfiles(entries); setActiveProfileId(active.id); setProfile(clone(active.profile)); setSelectedMacroSet(0);
        setNotice(entries.length > 1 ? `${entries.length}件のプロファイルを復元しました` : "プロファイルを復元しました");
      } catch {
        if (!cancelled) setNotice("ブラウザ内保存を利用できないため、この画面だけで編集します");
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
      void saveStoredProfile(entry).catch(() => setNotice("ブラウザ内へ保存できませんでした"));
    }, 0);
  }, [profile, activeProfileId, hydrated]);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) profileMenuRef.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") closeProfileMenus(); }
    document.addEventListener("pointerdown", closeOnOutsideClick); document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  const errors = useMemo(() => validateProfile(profile), [profile]);
  const seq = profile.sequences[selectedSequence];
  const selector = profile.selectors[selectedSelector];

  function update(mutator: (draft: Profile) => void) {
    setProfile((current) => { const draft = clone(current); mutator(draft); return draft; });
  }

  function showNotice(message: string) {
    setNotice(message); setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => { setToast(""); toastTimerRef.current = null; }, 2800);
  }

  function closeProfileMenus() {
    if (profileMenuRef.current) profileMenuRef.current.open = false;
  }

  async function saveAs() {
    try {
      const bytes = compileProfile(profile);
      const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
      const pickerWindow = window as FilePickerWindow;
      if (pickerWindow.showSaveFilePicker) {
        const handle = await pickerWindow.showSaveFilePicker({ suggestedName: profileFileName(profile.name), types: [{ description: "EASY ARCADE Macro", accept: { "application/octet-stream": [".eamacro"] } }] });
        const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
        setNotice(`${profileFileName(profile.name)}を保存しました`); return;
      }
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = profileFileName(profile.name);
      link.click(); URL.revokeObjectURL(href);
      setNotice(`${bytes.length.toLocaleString()} bytesの.eamacroを保存しました`);
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(error instanceof Error ? error.message : "保存できませんでした"); }
  }

  function activateProfile(entry: StoredProfile) {
    setActiveProfileId(entry.id); setProfile(clone(entry.profile));
    setSelectedSequence(0); setSelectedSelector(0); setSelectedMacroSet(0);
    closeProfileMenus();
  }

  function addStoredProfile(nextProfile: Profile, message: string) {
    const entry = { id: newProfileId(), profile: nextProfile, updatedAt: Date.now() };
    setStoredProfiles((current) => [entry, ...current]); activateProfile(entry);
    void saveStoredProfile(entry).catch(() => setNotice("ブラウザ内へ保存できませんでした"));
    setNotice(message);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseProfile(new Uint8Array(await file.arrayBuffer()));
      addStoredProfile(imported, `${file.name}を新しいプロファイルとして読み込みました`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "読み込めませんでした"); }
    event.target.value = "";
  }

  function addSequence() {
    if (profile.sequences.length >= 64) return;
    const used = new Set(profile.sequences.map((s) => s.id));
    let id = 0; while (used.has(id)) id++;
    update((draft) => draft.sequences.push({ id, name: `Macro ${id + 1}`, loopStart: 0, steps: [{ mask: 0, frames: 1 }] }));
    setSelectedSequence(profile.sequences.length); setNotice("新しいマクロを追加しました");
  }

  function duplicateSequence() {
    if (!seq) return;
    if (profile.sequences.length >= 64) { setNotice("マクロは64件までです"); return; }
    const sourceBindings = bindingsFor(profile, seq.id);
    if (profile.sequenceBindings.length + sourceBindings.length > MAX_SEQUENCE_BINDINGS) { setNotice(`マクロ割り当ては${MAX_SEQUENCE_BINDINGS}件までです`); return; }
    const used = new Set(profile.sequences.map((s) => s.id));
    let id = 0; while (used.has(id)) id++;
    update((draft) => {
      const source = draft.sequences[selectedSequence];
      draft.sequences.push({ ...clone(source), id, name: `${source.name} コピー` });
      draft.sequenceBindings.push(...draft.sequenceBindings.filter((binding) => binding.sequenceId === source.id).map((binding) => ({ ...binding, sequenceId: id })));
    });
    setSelectedSequence(profile.sequences.length);
    setNotice("マクロと入力割り当てを複製しました");
  }

  function addSelector() {
    if (profile.selectors.length >= 8) return;
    const used = new Set(profile.selectors.map((s) => s.id));
    let id = 0; while (used.has(id)) id++;
    update((draft) => draft.selectors.push({ id, name: `Selector ${id + 1}`, increment: 13, decrement: 14, min: 0, max: 1, initial: 0, wrap: false, neutralFrames: 1, outputs: [0, 0], stateNames: ["0", "1"] }));
    setSelectedSelector(profile.selectors.length); setNotice("新しいセレクタを追加しました");
  }

  function resetProfile() {
    if (!window.confirm("現在のプロファイルを初期化しますか？")) return;
    setProfile(createDefaultProfile());
    setSelectedSequence(0); setSelectedSelector(0); setSelectedMacroSet(0); setTab("mapping");
    setNotice("プロファイルを初期化しました");
    closeProfileMenus();
  }

  function createProfile() { addStoredProfile(createDefaultProfile(), "新しいプロファイルを作成しました"); }

  function duplicateProfile() {
    const copied = clone(profile); copied.name = `${profile.name} コピー`;
    addStoredProfile(copied, "プロファイルを複製しました");
  }

  async function deleteProfile() {
    if (!window.confirm(`「${profile.name}」をブラウザから削除しますか？`)) return;
    const remaining = storedProfiles.filter((entry) => entry.id !== activeProfileId);
    await removeStoredProfile(activeProfileId).catch(() => undefined);
    if (remaining.length) { setStoredProfiles(remaining); activateProfile(remaining[0]); }
    else {
      const blank = { id: newProfileId(), profile: createDefaultProfile(), updatedAt: Date.now() };
      setStoredProfiles([blank]); activateProfile(blank); void saveStoredProfile(blank);
    }
    setNotice("プロファイルを削除しました");
  }

  function addMacroSet() {
    if (profile.macroSets.names.length >= 16) { setNotice("マクロセットは16件までです"); return; }
    const next = profile.macroSets.names.length;
    update((draft) => draft.macroSets.names.push(`Set ${next}`));
    setSelectedMacroSet(next); setNotice(`Set ${next}を追加しました`);
  }

  function removeMacroSet(index: number) {
    if (profile.macroSets.names.length === 1) return;
    if (!window.confirm(`「${profile.macroSets.names[index]}」を削除しますか？`)) return;
    update((draft) => {
      draft.macroSets.names.splice(index, 1);
      draft.sequenceBindings = draft.sequenceBindings.filter((binding) => binding.setId !== index).map((binding) => binding.setId > index ? { ...binding, setId: binding.setId - 1 } : binding);
    });
    setSelectedMacroSet((current) => current > index ? current - 1 : Math.min(current, profile.macroSets.names.length - 2));
    setNotice("マクロセットを削除しました");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <Image className="brand-icon" src="/favicon.svg" alt="" width={30} height={30} priority />
          <h1>EASY ARCADE Macro Studio</h1>
        </div>
        <div className="header-actions">
          <input ref={fileRef} type="file" accept=".eamacro" hidden onChange={importFile} />
          <Link className="help-link" href="/help" title="ヘルプ" aria-label="ヘルプ">?</Link>
          <button className="file-action" title="プロファイルを読み込む" aria-label="プロファイルを読み込む" onClick={() => fileRef.current?.click()}><span aria-hidden="true">↧</span></button>
          <button className="file-action" title="プロファイルを書き出す" aria-label="プロファイルを書き出す" onClick={saveAs} disabled={errors.length > 0}><span aria-hidden="true">↥</span></button>
        </div>
      </header>

      <section className="profile-strip">
        <details className="profile-picker" ref={profileMenuRef}>
          <summary aria-label="プロファイルを選択">Profile</summary>
          <div className="profile-popover">
            <div className="profile-list" role="listbox" aria-label="保存済みプロファイル">{storedProfiles.map((entry) => <button role="option" aria-selected={entry.id === activeProfileId} className={entry.id === activeProfileId ? "active" : ""} onClick={() => activateProfile(entry)} key={entry.id}><span>{entry.profile.name}</span>{entry.id === activeProfileId && <b>✓</b>}</button>)}</div>
          </div>
        </details>
        <input className="profile-name" aria-label="プロファイル名" value={profile.name} onChange={(e) => update((d) => { d.name = e.target.value; })} />
        <div className="profile-row-actions">
          <button onClick={createProfile}>新規</button>
          <button onClick={duplicateProfile}>複製</button>
          <button onClick={resetProfile}>初期化</button>
          <button className="danger" onClick={deleteProfile}>削除</button>
        </div>
      </section>

      <nav className="tabs" aria-label="編集カテゴリ">
        <button className={tab === "mapping" ? "active" : ""} onClick={() => setTab("mapping")}>ボタン設定</button>
        <button className={tab === "macro" ? "active" : ""} onClick={() => setTab("macro")}>マクロ</button>
        <button className={tab === "macrosets" ? "active" : ""} onClick={() => setTab("macrosets")}>マクロセット</button>
        <button className={tab === "selector" ? "active" : ""} onClick={() => setTab("selector")}>ステートセレクタ</button>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>割り当て一覧</button>
        <button className={tab === "share" ? "active" : ""} onClick={() => setTab("share")}>共有</button>
      </nav>

      {tab === "mapping" && (
        <section className="workspace mapping-workspace">
          <div className="section-heading"><div><h2>ボタン設定</h2></div><p>連射を上書きしない場合は本体設定を使用します。</p></div>
          <div className="routing-head button-head"><span>論理ボタン</span><span>出力</span><span>連射</span></div>
          <div className="mapping-grid">
            {LOGICAL_BUTTONS.map((button, index) => (
              <article className="mapping-row button-row" key={button}>
                <div className="logical-label"><strong>{button}</strong></div>
                <div className="direct-route"><OutputToggles mask={profile.mappings[index]} onChange={(mask) => update((d) => { d.mappings[index] = mask; })} /></div>
                <div className="rapid-route">
                  <label className="override-check" title="本体の連射設定を上書き"><input aria-label={`${button}の連射設定を上書き`} type="checkbox" checked={profile.rapidFire[index].override} onChange={(e) => update((d) => { d.rapidFire[index].override = e.target.checked; })} /></label>
                  {profile.rapidFire[index].override && <div className="rapid-options"><select aria-label={`${button}の連射方式`} value={profile.rapidFire[index].triggerType} onChange={(e) => update((d) => { d.rapidFire[index].triggerType = e.target.value as "disabled" | "sync" | "front" | "back"; })}><option value="disabled">連射無効</option><option value="sync">同期</option><option value="front">表</option><option value="back">裏</option></select><label className="rapid-divisor"><span>1/</span><input aria-label={`${button}の連射分周比`} type="number" min="2" max="60" disabled={profile.rapidFire[index].triggerType === "disabled"} value={profile.rapidFire[index].divisor} onChange={(e) => update((d) => { d.rapidFire[index].divisor = Math.max(2, Math.min(60, Number(e.target.value))); })} /></label></div>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "macro" && (
        <section className="workspace macro-workspace">
          <MacroSetBar names={profile.macroSets.names} selected={selectedMacroSet} onChange={setSelectedMacroSet} frameStep={profile.frameStep} onFrameStepChange={(value) => update((draft) => { draft.frameStep = value; })} />
          <div className="split-workspace">
            <aside className="rail">
              <div className="rail-title"><h2>マクロ</h2><button onClick={addSequence} aria-label="マクロを追加">＋</button></div>
              <div className="rail-list">
                {profile.sequences.map((item, index) => {
                  const count = bindingsFor(profile, item.id).filter((binding) => binding.setId === selectedMacroSet).length;
                  return <button key={item.id} className={index === selectedSequence ? "rail-card active" : "rail-card"} onClick={() => setSelectedSequence(index)}>
                    <strong>{item.name}</strong><small>{count ? `${count}入力` : "未割り当て"} · {item.steps.reduce((n, s) => n + s.frames, 0) * profile.frameStep}フレーム</small>
                  </button>;
                })}
              </div>
            </aside>
            {seq ? <SequenceEditor key={seq.id} sequence={seq} frameStep={profile.frameStep} bindings={bindingsFor(profile, seq.id).filter((binding) => binding.setId === selectedMacroSet)} updateSequence={(mutator) => update((d) => mutator(d.sequences[selectedSequence]))}
              toggleTrigger={(logicalId) => update((d) => {
                const found = d.sequenceBindings.findIndex((b) => b.sequenceId === seq.id && b.logicalId === logicalId && b.setId === selectedMacroSet);
                if (found >= 0) d.sequenceBindings.splice(found, 1);
                else d.sequenceBindings.push({ logicalId, sequenceId: seq.id, setId: selectedMacroSet, loop: false, cancelOnRelease: false, transform: "none" });
              })}
              setBindingMode={(field, value) => update((d) => d.sequenceBindings.filter((b) => b.sequenceId === seq.id && b.setId === selectedMacroSet).forEach((b) => { b[field] = value; }))}
              setBindingTransform={(logicalId, transform) => update((d) => { const binding = d.sequenceBindings.find((b) => b.sequenceId === seq.id && b.logicalId === logicalId && b.setId === selectedMacroSet); if (binding) binding.transform = transform; })}
              duplicate={duplicateSequence}
              remove={() => { update((d) => { const removedId = d.sequences[selectedSequence].id; d.sequences.splice(selectedSequence, 1); d.sequenceBindings = d.sequenceBindings.filter((binding) => binding.sequenceId !== removedId); }); setSelectedSequence(0); }} /> : <EmptyState label="マクロがありません" action="＋ 最初のマクロを作る" onClick={addSequence} />}
          </div>
        </section>
      )}

      {tab === "macrosets" && <MacroSetEditor profile={profile} update={update} add={addMacroSet} remove={removeMacroSet} />}

      {tab === "selector" && (
        <section className="workspace split-workspace">
          <aside className="rail">
            <div className="rail-title"><h2>セレクタ</h2><button onClick={addSelector}>＋</button></div>
            <div className="rail-list">
              {profile.selectors.map((item, index) => (
                <button key={item.id} className={index === selectedSelector ? "rail-card active" : "rail-card"} onClick={() => setSelectedSelector(index)}>
                  <strong>{item.name}</strong><small>{item.min}〜{item.max} · {item.wrap ? "循環" : "端で停止"}</small>
                </button>
              ))}
            </div>
          </aside>
          {selector ? <SelectorEditor selector={selector} update={(mutator) => update((d) => mutator(d.selectors[selectedSelector]))}
            remove={() => { update((d) => d.selectors.splice(selectedSelector, 1)); setSelectedSelector(0); }} /> : <EmptyState label="セレクタがありません" action="＋ 最初のセレクタを作る" onClick={addSelector} />}
        </section>
      )}

      {tab === "overview" && <AssignmentOverview profile={profile} selectedMacroSet={selectedMacroSet} setSelectedMacroSet={setSelectedMacroSet} />}

      {tab === "share" && <SharedProfiles profile={profile} onImport={(imported, message) => { addStoredProfile(imported, message); showNotice(message); }} onNotice={showNotice} />}

      {toast && <div className="app-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>}

      <footer className="footerbar"><span className={errors.length ? "notice error" : "notice"}>{errors[0] || notice}</span></footer>
    </main>
  );
}

function MacroSetBar({ names, selected, onChange, label = "セット", frameStep, onFrameStepChange }: { names: string[]; selected: number; onChange: (value: number) => void; label?: string; frameStep?: number; onFrameStepChange?: (value: number) => void }) {
  return <div className="macro-set-bar"><span>{label}</span><select aria-label="編集するマクロセット" value={selected} onChange={(event) => onChange(Number(event.target.value))}>{names.map((name, index) => <option value={index} key={index}>{index} · {name}</option>)}</select>{frameStep !== undefined && onFrameStepChange && <label className="macro-tick"><span>1 tick =</span><input aria-label="1 tickあたりのフレーム数" type="number" min="1" max="255" value={frameStep} onChange={(event) => onFrameStepChange(Math.max(1, Math.min(255, Number(event.target.value))))} /><span>フレーム</span></label>}</div>;
}

function MacroSetEditor({ profile, update, add, remove }: { profile: Profile; update: (fn: (draft: Profile) => void) => void; add: () => void; remove: (index: number) => void }) {
  const config = profile.macroSets;
  return (
    <section className="workspace macro-set-workspace">
      <div className="section-heading"><div><h2>マクロセット</h2></div><button className="button" disabled={config.names.length >= 16} onClick={add}>＋ 追加</button></div>
      <div className="macro-set-table">
        <div className="macro-set-head"><span>Set ID</span><span>名前</span><span /></div>
        {config.names.map((name, index) => <div className="macro-set-row" key={index}><strong>{index}</strong><input aria-label={`Set ${index}の名前`} value={name} onChange={(event) => update((draft) => { draft.macroSets.names[index] = event.target.value; })} /><button disabled={config.names.length === 1} onClick={() => remove(index)}>削除</button></div>)}
      </div>
    </section>
  );
}

function SequenceEditor({ sequence, frameStep, bindings, updateSequence, toggleTrigger, setBindingMode, setBindingTransform, duplicate, remove }: {
  sequence: MacroSequence;
  frameStep: number;
  bindings: SequenceBinding[];
  updateSequence: (fn: (s: MacroSequence) => void) => void;
  toggleTrigger: (logicalId: number) => void;
  setBindingMode: (field: "loop" | "cancelOnRelease", value: boolean) => void;
  setBindingTransform: (logicalId: number, transform: OutputTransform) => void;
  duplicate: () => void;
  remove: () => void;
}) {
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
        <input className="title-input" aria-label="マクロ名" value={sequence.name} onChange={(e) => updateSequence((s) => { s.name = e.target.value; })} />
        <div className="editor-title-actions"><button onClick={duplicate}>複製</button><button onClick={remove}>削除</button></div>
      </div>
      <div className="macro-assignment-panel">
        <div className="trigger-heading"><h3>起動ボタン</h3><small>↔ / ↕ で出力方向を反転</small></div>
        <div className="trigger-buttons">{LOGICAL_BUTTONS.map((button, logicalId) => {
          const binding = bindings.find((item) => item.logicalId === logicalId);
          const axes = transformAxes(binding?.transform ?? "none");
          return <div className={binding ? "trigger-card active" : "trigger-card"} key={button}>
            <button className="trigger-main" aria-pressed={!!binding} onClick={() => toggleTrigger(logicalId)}>{button}</button>
            <div className="flip-flags"><button disabled={!binding} className={axes.horizontal ? "active" : ""} aria-label={`${button}の左右反転`} aria-pressed={axes.horizontal} onClick={() => binding && toggleTransformAxis(binding, "horizontal")}>↔</button><button disabled={!binding} className={axes.vertical ? "active" : ""} aria-label={`${button}の上下反転`} aria-pressed={axes.vertical} onClick={() => binding && toggleTransformAxis(binding, "vertical")}>↕</button></div>
          </div>;
        })}</div>
      </div>
      <div className="behavior-strip macro-behavior">
        <label className="control"><span>再生</span><select disabled={!bindings.length} value={loopValue} onChange={(e) => setBindingMode("loop", e.target.value === "loop")}><option value="once">1回再生</option><option value="loop">押している間反復</option>{loopValue === "mixed" && <option value="mixed">入力ごとに異なる</option>}</select></label>
        <label className="control"><span>離したとき</span><select disabled={!bindings.length} value={releaseValue} onChange={(e) => setBindingMode("cancelOnRelease", e.target.value === "cancel")}><option value="complete">現在の再生を完了</option><option value="cancel">すぐに中断</option>{releaseValue === "mixed" && <option value="mixed">入力ごとに異なる</option>}</select></label>
        <label className="control"><span>ループ開始</span><select value={sequence.loopStart} onChange={(e) => updateSequence((s) => { s.loopStart = Number(e.target.value); })}>{sequence.steps.map((_, i) => <option value={i} key={i}>{i + 1}</option>)}</select></label>
      </div>
      <div className="editor-toolbar"><span>{sequence.steps.length}ステップ · {total} tick · {total * frameStep}フレーム</span><div className="editor-mode"><button className={editorMode === "steps" ? "active" : ""} onClick={() => setEditorMode("steps")}>ステップ</button><button className={editorMode === "grid" ? "active" : ""} onClick={() => setEditorMode("grid")}>タイムライン</button></div></div>
      {editorMode === "steps" ? <><div className="steps-list"><div className="steps-head"><span>#</span><span>出力</span><span>tick</span><span /></div>
        {sequence.steps.map((step, index) => (
          <div className="step-group" key={index}>
            <button className="insert-step" disabled={sequence.steps.length >= 255} onClick={() => updateSequence((s) => { s.steps.splice(index, 0, { mask: 0, frames: 1 }); if (s.loopStart >= index) s.loopStart++; })}>＋ {index === 0 ? "先頭に挿入" : "ここに挿入"}</button>
            <article className="step-row">
              <div className="step-index">{index + 1}</div>
              <div className="step-output"><OutputToggles mask={step.mask} onChange={(mask) => updateSequence((s) => { s.steps[index].mask = mask; })} /></div>
              <div className="duration"><input aria-label={`ステップ${index + 1}のtick数`} type="number" min="1" max="65535" value={step.frames} onChange={(e) => updateSequence((s) => { s.steps[index].frames = Math.max(1, Math.min(65535, Number(e.target.value))); })} /></div>
              <button className="remove-step" disabled={sequence.steps.length === 1} onClick={() => updateSequence((s) => { const oldLoop = s.loopStart; s.steps.splice(index, 1); s.loopStart = oldLoop > index ? oldLoop - 1 : oldLoop === index ? Math.min(index, s.steps.length - 1) : oldLoop; })}>×</button>
            </article>
          </div>
        ))}
      </div><button className="add-row" disabled={sequence.steps.length >= 255} onClick={() => updateSequence((s) => { s.steps.push({ mask: 0, frames: 1 }); })}>＋ 末尾にステップを追加</button></> : <TimelineEditor sequence={sequence} updateSequence={updateSequence} />}
    </div>
  );
}

function TimelineEditor({ sequence, updateSequence }: { sequence: MacroSequence; updateSequence: (fn: (s: MacroSequence) => void) => void }) {
  const PAGE_SIZE = 64;
  const [page, setPage] = useState(0);
  const [selectedTick, setSelectedTick] = useState(0);
  const total = totalTicks(sequence);
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const safePage = Math.min(page, maxPage);
  const start = safePage * PAGE_SIZE;
  const count = Math.min(PAGE_SIZE, total - start);
  const ticks = Array.from({ length: count }, (_, index) => start + index);
  const selected = Math.min(selectedTick, total - 1);
  function goToPage(next: number) { const value = Math.max(0, Math.min(maxPage, next)); setPage(value); setSelectedTick(value * PAGE_SIZE); }
  return (
    <div className="piano-editor">
      <div className={maxPage > 0 ? "piano-toolbar" : "piano-toolbar single-page"}>
        {maxPage > 0 && <div><button disabled={safePage === 0} onClick={() => goToPage(safePage - 1)}>←</button><strong>{start + 1}–{start + count}</strong><button disabled={safePage === maxPage} onClick={() => goToPage(safePage + 1)}>→</button><span>{safePage + 1} / {maxPage + 1}</span></div>}
        <div className="frame-tools"><span>tick {selected + 1}</span><button onClick={() => { updateSequence((s) => insertTick(s, selected)); setSelectedTick(selected); }}>前に追加</button><button onClick={() => { updateSequence((s) => insertTick(s, selected + 1)); setSelectedTick(selected + 1); }}>後に追加</button><button className="danger" disabled={total <= 1} onClick={() => { updateSequence((s) => deleteTick(s, selected)); setSelectedTick(Math.max(0, selected - 1)); }}>削除</button></div>
      </div>
      <div className="piano-scroll">
        <div className="piano-grid" style={{ gridTemplateColumns: `76px repeat(${count}, 27px)` }}>
          <div className="piano-corner">出力</div>
          {ticks.map((tick) => <button key={`h${tick}`} className={selected === tick ? "frame-head selected" : "frame-head"} onClick={() => setSelectedTick(tick)}>{tick + 1}</button>)}
          {OUTPUTS.map((output, outputIndex) => <div className="piano-row" key={output} style={{ display: "contents" }}><div className="piano-label">{output}</div>{ticks.map((tick) => { const active = !!(maskAtTick(sequence, tick) & (1 << outputIndex)); return <button aria-label={`${tick + 1} tickの${output}`} key={`${output}-${tick}`} className={`${active ? "note active" : "note"}${selected === tick ? " selected" : ""}`} onClick={() => { setSelectedTick(tick); updateSequence((s) => setTickMask(s, tick, maskAtTick(s, tick) ^ (1 << outputIndex))); }}><i /></button>; })}</div>)}
        </div>
      </div>
      <div className="piano-footer"><button onClick={() => { updateSequence((s) => insertTick(s, total)); setSelectedTick(total); setPage(Math.floor(total / PAGE_SIZE)); }}>末尾に追加</button></div>
    </div>
  );
}

function SelectorEditor({ selector, update, remove }: { selector: StateSelector; update: (fn: (s: StateSelector) => void) => void; remove: () => void }) {
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
      <div className="editor-titleline"><input className="title-input" aria-label="セレクタ名" value={selector.name} onChange={(e) => update((s) => { s.name = e.target.value; })} /><div className="editor-title-actions"><button onClick={remove}>削除</button></div></div>
      <div className="control-grid six">
        <label className="control"><span>増加</span><select value={selector.increment} onChange={(e) => update((s) => { s.increment = Number(e.target.value); })}>{LOGICAL_BUTTONS.map((b, i) => <option value={i} key={b}>{b}</option>)}</select></label>
        <label className="control"><span>減少</span><select value={selector.decrement} onChange={(e) => update((s) => { s.decrement = Number(e.target.value); })}>{LOGICAL_BUTTONS.map((b, i) => <option value={i} key={b}>{b}</option>)}</select></label>
        <label className="control"><span>最大値</span><input type="number" min={selector.min} max={selector.min + 63} value={selector.max} onChange={(e) => setMax(Number(e.target.value))} /></label>
        <label className="control"><span>初期値</span><input type="number" min={selector.min} max={selector.max} value={selector.initial} onChange={(e) => update((s) => { s.initial = Number(e.target.value); })} /></label>
        <label className="control"><span>端の動作</span><select value={selector.wrap ? "wrap" : "clamp"} onChange={(e) => update((s) => { s.wrap = e.target.value === "wrap"; })}><option value="clamp">停止</option><option value="wrap">循環</option></select></label>
        <label className="control"><span>無出力フレーム</span><input type="number" min="0" max="255" value={selector.neutralFrames} onChange={(e) => update((s) => { s.neutralFrames = Number(e.target.value); })} /></label>
      </div>
      <div className="state-table"><div className="state-table-head"><span>状態</span><span>名前</span><span>出力</span></div>{selector.outputs.map((mask, index) => <div className="state-row" key={index}><strong>{selector.min + index}</strong><input className="state-name-input" aria-label={`状態${selector.min + index}の名前`} value={selector.stateNames[index]} onChange={(event) => update((s) => { s.stateNames[index] = event.target.value; })} /><OutputToggles mask={mask} onChange={(value) => update((s) => { s.outputs[index] = value; })} /></div>)}</div>
    </div>
  );
}

function AssignmentOverview({ profile, selectedMacroSet, setSelectedMacroSet }: { profile: Profile; selectedMacroSet: number; setSelectedMacroSet: (value: number) => void }) {
  return (
    <section className="workspace overview-workspace">
      <div className="section-heading"><div><h2>割り当て一覧</h2></div><MacroSetBar label="マクロセット" names={profile.macroSets.names} selected={selectedMacroSet} onChange={setSelectedMacroSet} /></div>
      <div className="overview-head"><span>論理ボタン</span><span>出力</span><span>連射</span><span>マクロ</span><span>セレクタ操作</span></div>
      <div className="overview-list">{LOGICAL_BUTTONS.map((button, logicalId) => {
        const macros = profile.sequenceBindings.filter((binding) => binding.logicalId === logicalId && binding.setId === selectedMacroSet).map((binding) => ({ binding, macro: profile.sequences.find((sequence) => sequence.id === binding.sequenceId) })).filter((item) => item.macro);
        const modifiers = profile.selectors.flatMap((selector) => [selector.increment === logicalId ? `${selector.name} ＋` : "", selector.decrement === logicalId ? `${selector.name} −` : ""]).filter(Boolean);
        const rapid = profile.rapidFire[logicalId];
        return <article className="overview-row" key={button}><div className="overview-logical"><strong>{button}</strong></div><div className="tag-list">{maskLabels(profile.mappings[logicalId]).map((label) => <span key={label}>{label}</span>)}{profile.mappings[logicalId] === 0 && <em>—</em>}</div><div className="overview-rapid">{!rapid.override ? "本体設定" : rapid.triggerType === "disabled" ? "連射無効" : `${RAPID_TYPE_LABELS[rapid.triggerType]} ${rapidRate(rapid.divisor)}`}</div><div className="tag-list macro-tags">{macros.map(({ macro, binding }) => macro && <span key={macro.id}>{macro.name}{binding.transform !== "none" ? ` · ${TRANSFORM_LABELS[binding.transform]}` : ""}</span>)}{macros.length === 0 && <em>—</em>}</div><div className="tag-list modifier-tags">{modifiers.map((label) => <span key={label}>{label}</span>)}{modifiers.length === 0 && <em>—</em>}</div></article>;
      })}</div>
    </section>
  );
}

function EmptyState({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><h2>{label}</h2><button className="button primary" onClick={onClick}>{action}</button></div>;
}
