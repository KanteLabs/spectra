/** IndexedDB persistence for user-uploaded media blobs. */

const DB_NAME = "nordmende-spectra-media";
const DB_VERSION = 1;
const STORE = "media";

export interface StoredUserMedia {
  id: string;
  label: string;
  kind: "video" | "image";
  mime: string;
  hasAudio: boolean;
  playEndSec?: number;
  displayScaled?: boolean;
  file: Blob;
  poster?: Blob;
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

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

export async function idbPutMedia(record: StoredUserMedia): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).put(record));
  } finally {
    db.close();
  }
}

export async function idbGetAllMedia(): Promise<StoredUserMedia[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    return await idbReq(tx.objectStore(STORE).getAll());
  } finally {
    db.close();
  }
}

export async function idbDeleteMedia(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

export async function idbClearMedia(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).clear());
  } finally {
    db.close();
  }
}
