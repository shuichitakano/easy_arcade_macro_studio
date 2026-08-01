import type { Profile } from "./profile";

export type StoredProfile = { id: string; profile: Profile; updatedAt: number };

// 製品名変更前から保存されているブラウザ内プロファイルとの互換性を維持する。
const DB_NAME = "easy-arcade-macro-editor";
const STORE_NAME = "profiles";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("プロファイル保存領域を開けませんでした"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("プロファイル保存に失敗しました"));
  });
}

export async function listStoredProfiles(): Promise<StoredProfile[]> {
  const db = await openDatabase();
  try {
    const values = await requestResult(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll() as IDBRequest<StoredProfile[]>);
    return values.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally { db.close(); }
}

export async function saveStoredProfile(entry: StoredProfile): Promise<void> {
  const db = await openDatabase();
  try { await requestResult(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(entry)); }
  finally { db.close(); }
}

export async function removeStoredProfile(id: string): Promise<void> {
  const db = await openDatabase();
  try { await requestResult(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id)); }
  finally { db.close(); }
}
