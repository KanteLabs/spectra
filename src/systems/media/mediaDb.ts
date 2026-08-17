import type { SourceKind } from "@/types";

const DB_NAME = "nordmende-spectra-media";
const DB_VERSION = 1;
const STORE = "userMedia";

export interface StoredUserMedia {
  id: string;
  label: string;
  kind: Extract<SourceKind, "video" | "image">;
  mimeType: string;
  blob: Blob;
  posterBlob?: Blob;
  hasAudio: boolean;
  colorAmount: number;
  width?: number;
  height?: number;
  durationSec?: number;
  /** Soft trim end in seconds (media fragment #t=0,N). */
  trimEndSec?: number;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

export async function idbPutMedia(record: StoredUserMedia): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB put failed"));
  });
  db.close();
}

export async function idbGetAllMedia(): Promise<StoredUserMedia[]> {
  const db = await openDb();
  const rows = await new Promise<StoredUserMedia[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredUserMedia[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error("IDB getAll failed"));
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function idbDeleteMedia(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
  });
  db.close();
}

export async function idbClearMedia(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB clear failed"));
  });
  db.close();
}
