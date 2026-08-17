import type { SourceDefinition } from "@/types";
import { emit } from "@/state/events";
import {
  idbClearMedia,
  idbDeleteMedia,
  idbGetAllMedia,
  idbPutMedia,
  type StoredUserMedia,
} from "./userMediaDb";
import {
  MAX_USER_MEDIA,
  processUserMediaFile,
} from "./mediaProcess";

export { MAX_USER_MEDIA, MAX_USER_MEDIA_BYTES } from "./mediaProcess";
/** @deprecated use MAX_USER_MEDIA */
export const MAX_USER_VIDEOS = MAX_USER_MEDIA;

type Listener = () => void;

const userSources: SourceDefinition[] = [];
const listeners = new Set<Listener>();
let hydratePromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeUserSources(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listUserSources(): SourceDefinition[] {
  return [...userSources];
}

export function getUserSourceDef(id: string): SourceDefinition | undefined {
  return userSources.find((s) => s.id === id);
}

export function isUserSourceId(id: string): boolean {
  return id.startsWith("user:");
}

function uniqueId(): string {
  return `user:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function recordToDef(record: StoredUserMedia): SourceDefinition {
  const url = URL.createObjectURL(record.file);
  const posterUrl = record.poster
    ? URL.createObjectURL(record.poster)
    : undefined;
  return {
    id: record.id,
    label: record.label,
    kind: record.kind,
    url,
    hasAudio: record.kind === "video" ? record.hasAudio : false,
    colorAmount: 1,
    posterUrl,
    playEndSec: record.playEndSec,
    displayScaled: record.displayScaled,
  };
}

/**
 * Restore uploads from IndexedDB (once per session).
 * Safe to call multiple times — subsequent calls await the same promise.
 */
export function hydrateUserSourcesFromDb(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const rows = await idbGetAllMedia();
      rows.sort((a, b) => a.createdAt - b.createdAt);
      for (const row of rows) {
        if (userSources.some((s) => s.id === row.id)) continue;
        userSources.push(recordToDef(row));
      }
      if (rows.length) notify();
    } catch {
      /* private mode / unsupported */
    }
  })();
  return hydratePromise;
}

export function updateUserSourceAudio(id: string, hasAudio: boolean): void {
  const def = userSources.find((s) => s.id === id);
  if (!def || def.hasAudio === hasAudio) return;
  def.hasAudio = hasAudio;
  notify();
  void idbGetAllMedia()
    .then(async (rows) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      row.hasAudio = hasAudio;
      await idbPutMedia(row);
    })
    .catch(() => undefined);
}

/**
 * Process + register a local video or image, persist to IndexedDB.
 */
export async function registerUserMediaFile(file: File): Promise<SourceDefinition> {
  if (userSources.length >= MAX_USER_MEDIA) {
    throw new Error(`You can upload up to ${MAX_USER_MEDIA} media items`);
  }

  const processed = await processUserMediaFile(file);
  const id = uniqueId();
  const record: StoredUserMedia = {
    id,
    label: processed.label,
    kind: processed.kind,
    mime: processed.mime,
    hasAudio: processed.hasAudioHint,
    playEndSec: processed.playEndSec,
    displayScaled: processed.displayScaled,
    file: processed.playbackBlob,
    poster: processed.posterBlob,
    createdAt: Date.now(),
  };

  try {
    await idbPutMedia(record);
  } catch {
    /* still allow in-memory use */
  }

  const def = recordToDef(record);
  userSources.push(def);
  notify();

  const bits: string[] = [`Loaded ${def.label}`];
  if (processed.displayScaled && processed.kind === "video") {
    bits.push("scaled for CRT");
  }
  if (processed.playEndSec) {
    bits.push(`trimmed to ${Math.round(processed.playEndSec / 60)} min`);
  }
  emit({ type: "announce", message: bits.join(" · ") });
  return def;
}

/** @deprecated prefer registerUserMediaFile */
export async function registerUserVideoFile(file: File): Promise<SourceDefinition> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Please choose a video file");
  }
  return registerUserMediaFile(file);
}

export function removeUserSource(id: string): SourceDefinition | undefined {
  const idx = userSources.findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  const [removed] = userSources.splice(idx, 1);
  if (removed.url?.startsWith("blob:")) URL.revokeObjectURL(removed.url);
  if (removed.posterUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(removed.posterUrl);
  }
  notify();
  void idbDeleteMedia(id).catch(() => undefined);
  emit({ type: "announce", message: `Removed ${removed.label}` });
  return removed;
}

export function clearUserSources(): void {
  while (userSources.length) {
    const removed = userSources.pop()!;
    if (removed.url?.startsWith("blob:")) URL.revokeObjectURL(removed.url);
    if (removed.posterUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(removed.posterUrl);
    }
  }
  notify();
  void idbClearMedia().catch(() => undefined);
}
