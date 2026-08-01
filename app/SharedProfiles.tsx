"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { compileProfile, parseProfile, Profile } from "./profile";

type SharedProfile = {
  id: string;
  profileName: string;
  description: string;
  authorName: string;
  tags: string[];
  fileSize: number;
  createdAt: string;
  isOwner: boolean;
};

type Props = {
  profile: Profile;
  onImport: (profile: Profile, message: string) => void;
  onNotice: (message: string) => void;
};

function fileName(name: string) {
  return `${name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "profile"}.eamacro`;
}

function responseError(value: unknown, fallback: string) {
  return typeof value === "object" && value && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

export function SharedProfiles({ profile, onImport, onNotice }: Props) {
  const [profiles, setProfiles] = useState<SharedProfile[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SharedProfile | null>(null);
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [authorName, setAuthorName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("easy-arcade-public-author") ?? "");

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [profileResponse, authResponse] = await Promise.all([
        fetch("/api/shared-profiles", { headers: { accept: "application/json" } }),
        fetch("/api/auth/me", { headers: { accept: "application/json" } }),
      ]);
      const profileData = await profileResponse.json() as { profiles?: SharedProfile[]; error?: string };
      const authData = await authResponse.json() as { authenticated?: boolean; localPreview?: boolean };
      if (!profileResponse.ok) throw new Error(responseError(profileData, "共有プロファイルを読み込めませんでした"));
      setProfiles(profileData.profiles ?? []);
      setAuthenticated(Boolean(authData.authenticated));
      setLocalPreview(Boolean(authData.localPreview));
    } catch (error) { setLoadError(error instanceof Error ? error.message : "共有プロファイルを読み込めませんでした"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    profiles.flatMap((item) => item.tags).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([name]) => name);
  }, [profiles]);

  const filtered = useMemo(() => profiles.filter((item) => {
    const needle = query.trim().toLocaleLowerCase();
    const matchesQuery = !needle || `${item.profileName}\n${item.description}\n${item.authorName}\n${item.tags.join(" ")}`.toLocaleLowerCase().includes(needle);
    return matchesQuery && (!tag || item.tags.some((itemTag) => itemTag.toLocaleLowerCase() === tag.toLocaleLowerCase()));
  }), [profiles, query, tag]);

  function beginPublishing() {
    if (!authenticated) {
      window.location.href = "/signin-with-chatgpt?return_to=%2F%3Ftab%3Dshare";
      return;
    }
    setEditingProfile(null); setDescription(""); setTagInput(""); setPublishOpen(true);
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setPublishing(true);
    try {
      const tags = tagInput.split(/[,、\n]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean);
      const payload: Record<string, unknown> = { authorName, description, tags };
      if (!editingProfile) {
        const bytes = compileProfile(profile);
        payload.fileBase64 = btoa(String.fromCharCode(...bytes));
      }
      const response = await fetch(editingProfile ? `/api/shared-profiles/${editingProfile.id}` : "/api/shared-profiles", {
        method: editingProfile ? "PATCH" : "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(responseError(data, "投稿できませんでした"));
      localStorage.setItem("easy-arcade-public-author", authorName.trim());
      const targetName = editingProfile?.profileName ?? profile.name;
      setPublishOpen(false); setEditingProfile(null); setDescription(""); setTagInput("");
      onNotice(editingProfile ? `「${targetName}」の公開情報を更新しました` : `「${targetName}」を共有しました`);
      await load();
    } catch (error) { onNotice(error instanceof Error ? error.message : "投稿できませんでした"); }
    finally { setPublishing(false); }
  }

  function beginEditing(item: SharedProfile) {
    setEditingProfile(item); setAuthorName(item.authorName); setDescription(item.description); setTagInput(item.tags.join(", ")); setPublishOpen(true);
    window.scrollTo({ top: 150, behavior: "smooth" });
  }

  async function openInEditor(item: SharedProfile) {
    try {
      const response = await fetch(`/api/shared-profiles/${item.id}/file`);
      if (!response.ok) throw new Error("プロファイルを読み込めませんでした");
      const imported = parseProfile(new Uint8Array(await response.arrayBuffer()));
      onImport(imported, `「${item.profileName}」を新しいプロファイルとして読み込みました`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "プロファイルを読み込めませんでした"); }
  }

  async function download(item: SharedProfile) {
    try {
      const response = await fetch(`/api/shared-profiles/${item.id}/file`);
      if (!response.ok) throw new Error("ダウンロードできませんでした");
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = href; link.download = fileName(item.profileName); link.click();
      URL.revokeObjectURL(href);
      onNotice(`「${item.profileName}」をダウンロードしました`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "ダウンロードできませんでした"); }
  }

  async function remove(item: SharedProfile) {
    if (!window.confirm(`共有ライブラリから「${item.profileName}」を削除しますか？`)) return;
    try {
      const response = await fetch(`/api/shared-profiles/${item.id}`, { method: "DELETE", headers: { accept: "application/json" } });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(responseError(data, "削除できませんでした"));
      setProfiles((current) => current.filter((entry) => entry.id !== item.id));
      onNotice(`「${item.profileName}」を共有ライブラリから削除しました`);
    } catch (error) { onNotice(error instanceof Error ? error.message : "削除できませんでした"); }
  }

  return (
    <section className="workspace share-workspace">
      <div className="share-heading">
        <div><h2>共有プロファイル</h2><p>ほかのユーザーが公開した設定を、そのままエディタへ読み込めます。</p></div>
        <div className="share-heading-actions">
          {localPreview ? <span className="share-account">ローカル確認</span> : authenticated ? <a className="share-account" href="/signout-with-chatgpt?return_to=%2F%3Ftab%3Dshare">ログアウト</a> : <span className="share-account">閲覧はログイン不要</span>}
          <button className="button primary" onClick={beginPublishing}>現在のプロファイルを共有</button>
        </div>
      </div>

      {publishOpen && <form className="publish-panel" onSubmit={publish}>
        <div className="publish-title"><div><span>{editingProfile ? "公開情報を編集" : "公開するプロファイル"}</span><strong>{editingProfile?.profileName ?? profile.name}</strong></div><button type="button" aria-label="閉じる" onClick={() => { setPublishOpen(false); setEditingProfile(null); }}>×</button></div>
        <div className="publish-fields">
          <label><span>作者名</span><input required maxLength={40} value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="公開用の名前" /></label>
          <label className="publish-description"><span>短い説明</span><textarea maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="用途や操作感を簡潔に" /></label>
          <label><span>タグ</span><input maxLength={200} value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="格闘, 6ボタン, 共通" /><small>カンマ区切り、最大8個</small></label>
        </div>
        <div className="publish-actions"><span>ChatGPTの名前やメールアドレスは公開されません。</span><button className="button primary" disabled={publishing}>{publishing ? "保存中…" : editingProfile ? "変更を保存" : "公開する"}</button></div>
      </form>}

      <div className="library-tools">
        <label className="library-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・説明・作者で検索" /></label>
        {allTags.length > 0 && <div className="library-tags"><button className={!tag ? "active" : ""} onClick={() => setTag("")}>すべて</button>{allTags.map((item) => <button className={tag === item ? "active" : ""} onClick={() => setTag(item)} key={item}>#{item}</button>)}</div>}
      </div>

      {loading ? <div className="library-message">共有プロファイルを読み込んでいます…</div>
        : loadError ? <div className="library-message error"><p>{loadError}</p><button className="button" onClick={() => void load()}>再読み込み</button></div>
          : filtered.length === 0 ? <div className="library-message"><p>{profiles.length ? "条件に合うプロファイルがありません。" : "まだ共有プロファイルがありません。最初のひとつを公開できます。"}</p></div>
            : <div className="profile-library">{filtered.map((item) => <article className="shared-profile-card" key={item.id}>
              <div className="shared-card-head"><div><h3>{item.profileName}</h3><span>by {item.authorName}</span></div>{item.isOwner && <div className="shared-owner-actions"><button onClick={() => beginEditing(item)}>編集</button><button className="shared-delete" onClick={() => void remove(item)}>削除</button></div>}</div>
              <p>{item.description || "説明はありません。"}</p>
              <div className="shared-tags">{item.tags.map((itemTag) => <button onClick={() => setTag(itemTag)} key={itemTag}>#{itemTag}</button>)}</div>
              <div className="shared-card-meta"><span>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(item.createdAt))}</span><span>{item.fileSize.toLocaleString()} bytes</span></div>
              <div className="shared-card-actions"><button className="button" onClick={() => void download(item)}>ダウンロード</button><button className="button primary" onClick={() => void openInEditor(item)}>エディタで開く</button></div>
            </article>)}</div>}
    </section>
  );
}
