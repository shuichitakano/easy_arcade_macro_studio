/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

type SharedProfileRow = {
  id: string;
  profile_name: string;
  description: string;
  author_name: string;
  tags_json: string;
  file_size: number;
  created_at: string;
  owner_user_id: string;
};

const MAX_PROFILE_BYTES = 8192;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function authenticatedUserId(request: Request) {
  const platformUserId = request.headers.get("oai-authenticated-user-id")?.trim();
  if (platformUserId) return platformUserId;
  return isLocalRequest(request) ? "local-preview-user" : null;
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeProfile(encoded: unknown): Uint8Array {
  if (typeof encoded !== "string" || encoded.length > 12000) throw new Error("プロファイルデータが不正です");
  let binary: string;
  try { binary = atob(encoded); } catch { throw new Error("プロファイルデータが不正です"); }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length < 16 || bytes.length > MAX_PROFILE_BYTES) throw new Error("プロファイルのサイズが不正です");
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "AMAP") throw new Error("AMAPファイルではありません");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== bytes.length || view.getUint32(12, true) !== crc32(bytes.subarray(16))) throw new Error("プロファイルが破損しています");
  return bytes;
}

function profileNameFromBytes(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 16;
  while (cursor + 4 <= bytes.length) {
    const type = bytes[cursor];
    const length = view.getUint16(cursor + 2, true);
    const end = cursor + 4 + length;
    if (end > bytes.length) break;
    if (type === 0x7f) {
      try {
        const metadata = JSON.parse(new TextDecoder().decode(bytes.subarray(cursor + 4, end))) as { name?: unknown };
        if (typeof metadata.name === "string" && metadata.name.trim()) return metadata.name.trim().slice(0, 120);
      } catch { break; }
    }
    cursor = end;
  }
  return "Untitled Profile";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength) : "";
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const unique = new Map<string, string>();
  for (const item of value) {
    const tag = cleanText(item, 24).replace(/^#/, "");
    if (tag) unique.set(tag.toLocaleLowerCase(), tag);
    if (unique.size >= 8) break;
  }
  return [...unique.values()];
}

function safeFileName(name: string) {
  return `${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "profile"}.eamacro`;
}

function d1BlobBytes(value: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new Error("保存されたプロファイルデータが不正です");
}

async function handleSharedProfiles(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return json({ authenticated: Boolean(authenticatedUserId(request)), localPreview: isLocalRequest(request) });
  }
  if (!url.pathname.startsWith("/api/shared-profiles")) return null;
  if (!env.DB) return json({ error: "共有ライブラリのデータベースを利用できません" }, 503);

  const userId = authenticatedUserId(request);
  if (url.pathname === "/api/shared-profiles" && request.method === "GET") {
    const query = cleanText(url.searchParams.get("q"), 80);
    const tag = cleanText(url.searchParams.get("tag"), 24).toLocaleLowerCase();
    const conditions: string[] = [];
    const bindings: unknown[] = [];
    if (query) {
      conditions.push("(profile_name LIKE ? OR description LIKE ? OR author_name LIKE ?)");
      const pattern = `%${query}%`;
      bindings.push(pattern, pattern, pattern);
    }
    if (tag) {
      conditions.push("EXISTS (SELECT 1 FROM shared_profile_tags t WHERE t.profile_id = shared_profiles.id AND t.tag_normalized = ?)");
      bindings.push(tag);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await env.DB.prepare(`SELECT id, profile_name, description, author_name, tags_json, file_size, created_at, owner_user_id FROM shared_profiles ${where} ORDER BY created_at DESC LIMIT 100`).bind(...bindings).all<SharedProfileRow>();
    return json({ profiles: result.results.map((row) => ({
      id: row.id,
      profileName: row.profile_name,
      description: row.description,
      authorName: row.author_name,
      tags: JSON.parse(row.tags_json) as string[],
      fileSize: row.file_size,
      createdAt: row.created_at,
      isOwner: Boolean(userId && row.owner_user_id === userId),
    })) });
  }

  if (url.pathname === "/api/shared-profiles" && request.method === "POST") {
    if (!userId) return json({ error: "投稿するにはChatGPTでログインしてください" }, 401);
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "送信内容が不正です" }, 400); }
    let bytes: Uint8Array;
    try { bytes = decodeProfile(body.fileBase64); } catch (error) { return json({ error: error instanceof Error ? error.message : "プロファイルが不正です" }, 400); }
    const authorName = cleanText(body.authorName, 40);
    const description = cleanText(body.description, 240);
    const tags = cleanTags(body.tags);
    if (!authorName) return json({ error: "公開する作者名を入力してください" }, 400);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const profileName = profileNameFromBytes(bytes);
    const fileData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const statements = [env.DB.prepare("INSERT INTO shared_profiles (id, owner_user_id, profile_name, description, author_name, tags_json, file_data, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, userId, profileName, description, authorName, JSON.stringify(tags), fileData, bytes.length, now, now)];
    for (const tagValue of tags) statements.push(env.DB.prepare("INSERT INTO shared_profile_tags (profile_id, tag, tag_normalized) VALUES (?, ?, ?)").bind(id, tagValue, tagValue.toLocaleLowerCase()));
    await env.DB.batch(statements);
    return json({ id }, 201);
  }

  const fileMatch = url.pathname.match(/^\/api\/shared-profiles\/([0-9a-f-]+)\/file$/i);
  if (fileMatch && request.method === "GET") {
    const row = await env.DB.prepare("SELECT profile_name, file_data FROM shared_profiles WHERE id = ?").bind(fileMatch[1]).first<{ profile_name: string; file_data: ArrayBuffer | Uint8Array | number[] }>();
    if (!row) return json({ error: "プロファイルが見つかりません" }, 404);
    const bytes = d1BlobBytes(row.file_data);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new Response(body, { headers: { "content-type": "application/octet-stream", "content-length": String(bytes.length), "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName(row.profile_name))}`, "cache-control": "public, max-age=300" } });
  }

  const itemMatch = url.pathname.match(/^\/api\/shared-profiles\/([0-9a-f-]+)$/i);
  if (itemMatch && request.method === "PATCH") {
    if (!userId) return json({ error: "編集するにはChatGPTでログインしてください" }, 401);
    const owned = await env.DB.prepare("SELECT id FROM shared_profiles WHERE id = ? AND owner_user_id = ?").bind(itemMatch[1], userId).first<{ id: string }>();
    if (!owned) return json({ error: "編集できるのは自分の投稿だけです" }, 403);
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "送信内容が不正です" }, 400); }
    const authorName = cleanText(body.authorName, 40);
    const description = cleanText(body.description, 240);
    const tags = cleanTags(body.tags);
    if (!authorName) return json({ error: "公開する作者名を入力してください" }, 400);
    const statements = [
      env.DB.prepare("UPDATE shared_profiles SET description = ?, author_name = ?, tags_json = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?").bind(description, authorName, JSON.stringify(tags), new Date().toISOString(), itemMatch[1], userId),
      env.DB.prepare("DELETE FROM shared_profile_tags WHERE profile_id = ?").bind(itemMatch[1]),
    ];
    for (const tagValue of tags) statements.push(env.DB.prepare("INSERT INTO shared_profile_tags (profile_id, tag, tag_normalized) VALUES (?, ?, ?)").bind(itemMatch[1], tagValue, tagValue.toLocaleLowerCase()));
    await env.DB.batch(statements);
    return json({ updated: true });
  }

  if (itemMatch && request.method === "DELETE") {
    if (!userId) return json({ error: "削除するにはChatGPTでログインしてください" }, 401);
    const owned = await env.DB.prepare("SELECT id FROM shared_profiles WHERE id = ? AND owner_user_id = ?").bind(itemMatch[1], userId).first<{ id: string }>();
    if (!owned) return json({ error: "削除できるのは自分の投稿だけです" }, 403);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM shared_profile_tags WHERE profile_id = ?").bind(itemMatch[1]),
      env.DB.prepare("DELETE FROM shared_profiles WHERE id = ? AND owner_user_id = ?").bind(itemMatch[1], userId),
    ]);
    return json({ deleted: true });
  }

  return json({ error: "Not found" }, 404);
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      const apiResponse = await handleSharedProfiles(request, env, url);
      if (apiResponse) return apiResponse;
    } catch (error) {
      if (url.pathname.startsWith("/api/")) {
        console.error("Shared profile API error", error);
        return json({ error: "共有ライブラリを一時的に利用できません" }, 503);
      }
      throw error;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
