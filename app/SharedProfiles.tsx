"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { compileProfile, localizeProfileMessage, parseProfile, Profile } from "./profile";
import { useI18n } from "./i18n";

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
  const { locale, t } = useI18n();
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
        fetch("/api/shared-profiles", { headers: { accept: "application/json", "x-easy-arcade-language": locale } }),
        fetch("/api/auth/me", { headers: { accept: "application/json", "x-easy-arcade-language": locale } }),
      ]);
      const profileData = await profileResponse.json() as { profiles?: SharedProfile[]; error?: string };
      const authData = await authResponse.json() as { authenticated?: boolean; localPreview?: boolean };
      if (!profileResponse.ok) throw new Error(responseError(profileData, t("共有プロファイルを読み込めませんでした", "Could not load shared profiles")));
      setProfiles(profileData.profiles ?? []);
      setAuthenticated(Boolean(authData.authenticated));
      setLocalPreview(Boolean(authData.localPreview));
    } catch (error) { setLoadError(error instanceof Error ? error.message : t("共有プロファイルを読み込めませんでした", "Could not load shared profiles")); }
    finally { setLoading(false); }
  }, [locale, t]);

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
        headers: { "content-type": "application/json", accept: "application/json", "x-easy-arcade-language": locale },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(responseError(data, t("投稿できませんでした", "Could not publish the profile")));
      localStorage.setItem("easy-arcade-public-author", authorName.trim());
      const targetName = editingProfile?.profileName ?? profile.name;
      setPublishOpen(false); setEditingProfile(null); setDescription(""); setTagInput("");
      onNotice(editingProfile ? t(`「${targetName}」の公開情報を更新しました`, `Updated sharing details for “${targetName}”`) : t(`「${targetName}」を共有しました`, `Published “${targetName}”`));
      await load();
    } catch (error) { onNotice(error instanceof Error ? localizeProfileMessage(error.message, locale) : t("投稿できませんでした", "Could not publish the profile")); }
    finally { setPublishing(false); }
  }

  function beginEditing(item: SharedProfile) {
    setEditingProfile(item); setAuthorName(item.authorName); setDescription(item.description); setTagInput(item.tags.join(", ")); setPublishOpen(true);
    window.scrollTo({ top: 150, behavior: "smooth" });
  }

  async function openInEditor(item: SharedProfile) {
    try {
      const response = await fetch(`/api/shared-profiles/${item.id}/file`);
      if (!response.ok) throw new Error(t("プロファイルを読み込めませんでした", "Could not open the profile"));
      const imported = parseProfile(new Uint8Array(await response.arrayBuffer()));
      onImport(imported, t(`「${item.profileName}」を新しいプロファイルとして読み込みました`, `Opened “${item.profileName}” as a new profile`));
    } catch (error) { onNotice(error instanceof Error ? localizeProfileMessage(error.message, locale) : t("プロファイルを読み込めませんでした", "Could not open the profile")); }
  }

  async function download(item: SharedProfile) {
    try {
      const response = await fetch(`/api/shared-profiles/${item.id}/file`);
      if (!response.ok) throw new Error(t("ダウンロードできませんでした", "Could not download the profile"));
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = href; link.download = fileName(item.profileName); link.click();
      URL.revokeObjectURL(href);
      onNotice(t(`「${item.profileName}」をダウンロードしました`, `Downloaded “${item.profileName}”`));
    } catch (error) { onNotice(error instanceof Error ? error.message : t("ダウンロードできませんでした", "Could not download the profile")); }
  }

  async function remove(item: SharedProfile) {
    if (!window.confirm(t(`共有ライブラリから「${item.profileName}」を削除しますか？`, `Delete “${item.profileName}” from the shared library?`))) return;
    try {
      const response = await fetch(`/api/shared-profiles/${item.id}`, { method: "DELETE", headers: { accept: "application/json", "x-easy-arcade-language": locale } });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(responseError(data, t("削除できませんでした", "Could not delete the profile")));
      setProfiles((current) => current.filter((entry) => entry.id !== item.id));
      onNotice(t(`「${item.profileName}」を共有ライブラリから削除しました`, `Deleted “${item.profileName}” from the shared library`));
    } catch (error) { onNotice(error instanceof Error ? error.message : t("削除できませんでした", "Could not delete the profile")); }
  }

  return (
    <section className="workspace share-workspace">
      <div className="share-heading">
        <div><h2>{t("共有プロファイル", "Shared Profiles")}</h2><p>{t("現在のプロファイルを公開したり、ほかのユーザーが公開したプロファイルを読み込んだりできます。", "Publish the current profile or open profiles shared by other users.")}</p></div>
        <div className="share-heading-actions">
          {localPreview ? <span className="share-account">{t("ローカル確認", "Local preview")}</span> : authenticated ? <a className="share-account" href="/signout-with-chatgpt?return_to=%2F%3Ftab%3Dshare">{t("ログアウト", "Sign out")}</a> : <span className="share-account">{t("閲覧はログイン不要", "No sign-in required to browse")}</span>}
          <button className="button primary" onClick={beginPublishing}>{t("現在のプロファイルを共有", "Publish Current Profile")}</button>
        </div>
      </div>

      {publishOpen && <form className="publish-panel" onSubmit={publish}>
        <div className="publish-title"><div><span>{editingProfile ? t("公開情報を編集", "Edit sharing details") : t("公開するプロファイル", "Profile to publish")}</span><strong>{editingProfile?.profileName ?? profile.name}</strong></div><button type="button" aria-label={t("閉じる", "Close")} onClick={() => { setPublishOpen(false); setEditingProfile(null); }}>×</button></div>
        <div className="publish-fields">
          <label><span>{t("作者名", "Author name")}</span><input required maxLength={40} value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder={t("公開用の名前", "Public alias")} /></label>
          <label className="publish-description"><span>{t("短い説明", "Short description")}</span><textarea maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("用途や操作感を簡潔に", "Briefly describe its use or feel")} /></label>
          <label><span>{t("タグ", "Tags")}</span><input maxLength={200} value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder={t("格闘, 6ボタン, 共通", "fighting, 6-button, general")} /><small>{t("カンマ区切り、最大8個", "Comma-separated, up to 8")}</small></label>
        </div>
        <div className="publish-actions"><span>{t("ChatGPTの名前やメールアドレスは公開されません。", "Your ChatGPT name and email address are not made public.")}</span><button className="button primary" disabled={publishing}>{publishing ? t("保存中…", "Saving…") : editingProfile ? t("変更を保存", "Save Changes") : t("公開する", "Publish")}</button></div>
      </form>}

      <div className="library-tools">
        <label className="library-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("名前・説明・作者で検索", "Search name, description, or author")} /></label>
        {allTags.length > 0 && <div className="library-tags"><button className={!tag ? "active" : ""} onClick={() => setTag("")}>{t("すべて", "All")}</button>{allTags.map((item) => <button className={tag === item ? "active" : ""} onClick={() => setTag(item)} key={item}>#{item}</button>)}</div>}
      </div>

      {loading ? <div className="library-message">{t("共有プロファイルを読み込んでいます…", "Loading shared profiles…")}</div>
        : loadError ? <div className="library-message error"><p>{loadError}</p><button className="button" onClick={() => void load()}>{t("再読み込み", "Reload")}</button></div>
          : filtered.length === 0 ? <div className="library-message"><p>{profiles.length ? t("条件に合うプロファイルがありません。", "No profiles match these filters.") : t("まだ共有プロファイルがありません。最初のひとつを公開できます。", "No profiles have been shared yet. You can publish the first one.")}</p></div>
            : <div className="profile-library">{filtered.map((item) => <article className="shared-profile-card" key={item.id}>
              <div className="shared-card-head"><div><h3>{item.profileName}</h3><span>by {item.authorName}</span></div>{item.isOwner && <div className="shared-owner-actions"><button onClick={() => beginEditing(item)}>{t("編集", "Edit")}</button><button className="shared-delete" onClick={() => void remove(item)}>{t("削除", "Delete")}</button></div>}</div>
              <p>{item.description || t("説明はありません。", "No description.")}</p>
              <div className="shared-tags">{item.tags.map((itemTag) => <button onClick={() => setTag(itemTag)} key={itemTag}>#{itemTag}</button>)}</div>
              <div className="shared-card-meta"><span>{new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { dateStyle: "medium" }).format(new Date(item.createdAt))}</span><span>{item.fileSize.toLocaleString(locale === "ja" ? "ja-JP" : "en-US")} bytes</span></div>
              <div className="shared-card-actions"><button className="button" onClick={() => void download(item)}>{t("ダウンロード", "Download")}</button><button className="button primary" onClick={() => void openInEditor(item)}>{t("エディタで開く", "Open in Editor")}</button></div>
            </article>)}</div>}
    </section>
  );
}
