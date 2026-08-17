import * as THREE from "three";
import type { SourceLoadState } from "@/types";
import { getSourceDef } from "./sourceCatalog";
import { createProceduralById, createSmptePattern } from "./proceduralSources";
import { updateUserSourceAudio, isUserSourceId } from "./userSources";
import {
  shouldPauseManagedVideo,
  videoIdsToKeepPlaying,
} from "./playbackPolicy";

export interface ManagedSource {
  id: string;
  texture: THREE.Texture;
  video?: HTMLVideoElement;
  loadState: SourceLoadState;
  update?: (t: number) => void;
  dispose: () => void;
  hasAudio: boolean;
  /**
   * True when `update` costs real CPU (canvas redraw + texture upload) so it can
   * be skipped for sources that are not on a powered CRT.
   */
  heavyUpdate?: boolean;
}

type Listener = (id: string, state: SourceLoadState) => void;

/**
 * Detect whether a video element has an audio track.
 * Avoids captureStream().stop() which can break blob playback in some browsers.
 */
export async function detectVideoHasAudio(
  video: HTMLVideoElement
): Promise<boolean> {
  await new Promise<void>((resolve) => {
    if (video.readyState >= 1) resolve();
    else video.addEventListener("loadedmetadata", () => resolve(), { once: true });
  });

  const v = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };

  if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio;
  if (v.audioTracks && typeof v.audioTracks.length === "number") {
    return v.audioTracks.length > 0;
  }

  const capture = v.captureStream?.bind(v) ?? v.mozCaptureStream?.bind(v);
  if (capture) {
    try {
      const stream = capture();
      return stream.getAudioTracks().length > 0;
    } catch {
      /* fall through */
    }
  }

  if (typeof v.webkitAudioDecodedByteCount === "number") {
    return v.webkitAudioDecodedByteCount > 0;
  }

  return true;
}

/**
 * Procedural canvas textures + VideoTextures / still images.
 * Render-target sources register via registerExternal.
 */
export class SourceManager {
  private sources = new Map<string, ManagedSource>();
  private listeners = new Set<Listener>();
  private fallbackPattern: ManagedSource | null = null;
  /** Last set of source ids that must stay playing (powered CRTs). */
  private keepPlayingIds = new Set<string>();

  onLoadState(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(id: string, state: SourceLoadState) {
    this.listeners.forEach((l) => l(id, state));
  }

  get(id: string): ManagedSource | undefined {
    return this.sources.get(id);
  }

  getTexture(id: string): THREE.Texture | null {
    return this.sources.get(id)?.texture ?? this.fallbackPattern?.texture ?? null;
  }

  ensureFallback(): ManagedSource {
    if (!this.fallbackPattern) {
      const p = createSmptePattern();
      this.fallbackPattern = {
        id: "_fallback",
        texture: p.texture,
        loadState: "ready",
        dispose: p.dispose,
        hasAudio: false,
      };
    }
    return this.fallbackPattern;
  }

  async ensure(id: string): Promise<ManagedSource> {
    const existing = this.sources.get(id);
    if (existing) {
      if (existing.video && existing.loadState === "ready") {
        void existing.video.play().catch(() => undefined);
      }
      return existing;
    }

    const def = getSourceDef(id);
    if (!def) return this.ensureFallback();

    if (def.kind === "video" && def.url) {
      return this.createVideoSource(id, def.url, {
        hasAudioHint: def.hasAudio !== false,
        playEndSec: def.playEndSec,
      });
    }

    if (def.kind === "image" && def.url) {
      return this.createImageSource(id, def.url);
    }

    if (def.kind === "procedural") {
      return this.createProcedural(id);
    }

    return this.ensureFallback();
  }

  registerExternal(source: ManagedSource): void {
    this.sources.set(source.id, source);
    this.notify(source.id, source.loadState);
  }

  remove(id: string): void {
    const existing = this.sources.get(id);
    if (!existing) return;
    existing.dispose();
    this.sources.delete(id);
  }

  private createProcedural(id: string): ManagedSource {
    const clip = createProceduralById(id) ?? createSmptePattern();
    const managed: ManagedSource = {
      id,
      texture: clip.texture,
      loadState: "ready",
      update: clip.update,
      dispose: clip.dispose,
      hasAudio: false,
      // Canvas 2D redraw + full texture upload per frame
      heavyUpdate: !!clip.update,
    };
    this.sources.set(id, managed);
    this.notify(id, "ready");
    return managed;
  }

  private createImageSource(id: string, url: string): ManagedSource {
    const managed: ManagedSource = {
      id,
      texture: this.ensureFallback().texture,
      loadState: "loading",
      hasAudio: false,
      dispose: () => {
        /* replaced below */
      },
    };
    this.sources.set(id, managed);
    this.notify(id, "loading");

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        managed.texture = texture;
        managed.loadState = "ready";
        managed.dispose = () => texture.dispose();
        this.notify(id, "ready");
      },
      undefined,
      () => {
        managed.loadState = "error";
        managed.texture = this.ensureFallback().texture;
        this.notify(id, "error");
      }
    );

    return managed;
  }

  private createVideoSource(
    id: string,
    url: string,
    opts: {
      hasAudioHint: boolean;
      playEndSec?: number;
    }
  ): ManagedSource {
    const video = document.createElement("video");
    video.playsInline = true;
    video.loop = !opts.playEndSec;
    video.muted = true;
    video.preload = "auto";
    // Prefer GPU decode → VideoTexture; avoid per-frame canvas blit (stutters with 4 CRTs)
    if (!url.startsWith("blob:")) {
      video.crossOrigin = "anonymous";
    }
    video.src = url;

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const managed: ManagedSource = {
      id,
      texture,
      video,
      loadState: "loading",
      hasAudio: opts.hasAudioHint,
      update: () => {
        // Soft-trim long uploads without touching the texture every frame
        if (opts.playEndSec && video.currentTime >= opts.playEndSec) {
          video.currentTime = 0;
          void video.play().catch(() => undefined);
        }
        // Belt-and-suspenders: rVFC can stall after post-FX pass rebuilds while
        // the element keeps decoding (audio continues, CRT looks frozen).
        if (
          !video.paused &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          texture.needsUpdate = true;
        }
      },
      dispose: () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
        texture.dispose();
      },
    };
    this.sources.set(id, managed);
    this.notify(id, "loading");

    const onPause = () => {
      if (managed.loadState !== "ready") return;
      if (shouldPauseManagedVideo(id, this.keepPlayingIds)) return;
      // Browser often pauses on tab hide / audio interrupt — kick play again.
      requestAnimationFrame(() => {
        if (!managed.video || !managed.video.paused) return;
        if (shouldPauseManagedVideo(id, this.keepPlayingIds)) return;
        void managed.video.play().catch(() => undefined);
      });
    };
    video.addEventListener("pause", onPause);

    const finishReady = async () => {
      if (managed.loadState === "error") return;
      try {
        const hasAudio = await detectVideoHasAudio(video);
        managed.hasAudio = hasAudio;
        if (isUserSourceId(id)) {
          updateUserSourceAudio(id, hasAudio);
        }
      } catch {
        /* keep hint */
      }
      managed.loadState = "ready";
      this.notify(id, "ready");
      video.play().catch(() => undefined);
    };

    video.addEventListener("loadeddata", () => {
      void finishReady();
    });
    video.addEventListener("error", () => {
      managed.loadState = "error";
      managed.hasAudio = false;
      this.notify(id, "error");
      managed.texture = this.ensureFallback().texture;
    });

    video.load();
    return managed;
  }

  /**
   * Advance animated sources. Pass the ids on powered CRTs to skip canvas
   * redraws + texture uploads for off-screen procedural channels — with all
   * built-ins loaded that is the difference between 4 and 10 uploads a frame.
   */
  update(time: number, visibleIds?: ReadonlySet<string>): void {
    this.sources.forEach((s) => {
      if (!s.update) return;
      if (visibleIds && s.heavyUpdate && !visibleIds.has(s.id)) return;
      s.update(time);
    });
  }

  muteAllVideos(): void {
    this.sources.forEach((s) => {
      if (s.video) s.video.muted = true;
    });
  }

  /**
   * Keep videos playing on every CRT that needs them; pause only unused clips.
   * (Do not tie playback to the single audio program source.)
   */
  syncPlaybackForSourceIds(activeIds: Iterable<string>): void {
    this.keepPlayingIds = videoIdsToKeepPlaying(Array.from(activeIds));
    this.sources.forEach((s) => {
      if (!s.video || s.loadState !== "ready") return;
      if (shouldPauseManagedVideo(s.id, this.keepPlayingIds)) {
        if (!s.video.paused) s.video.pause();
      } else if (s.video.paused) {
        void s.video.play().catch(() => undefined);
      }
    });
  }

  /** Re-play any video that belongs on a powered CRT (post-interruption). */
  resumeKeepPlaying(): void {
    this.sources.forEach((s) => {
      if (!s.video || s.loadState !== "ready") return;
      if (shouldPauseManagedVideo(s.id, this.keepPlayingIds)) return;
      if (s.video.paused) {
        void s.video.play().catch(() => undefined);
      }
    });
  }

  setMuted(id: string, muted: boolean): void {
    const s = this.sources.get(id);
    if (s?.video) s.video.muted = muted;
  }

  setVolume(id: string, volume: number): void {
    const s = this.sources.get(id);
    if (s?.video) s.video.volume = Math.min(1, Math.max(0, volume));
  }

  pauseAll(): void {
    this.keepPlayingIds.clear();
    this.sources.forEach((s) => s.video?.pause());
  }

  resumeReady(): void {
    this.sources.forEach((s) => {
      if (s.video && s.loadState === "ready") {
        s.video.play().catch(() => undefined);
      }
    });
  }

  dispose(): void {
    this.sources.forEach((s) => s.dispose());
    this.sources.clear();
    this.fallbackPattern?.dispose();
    this.fallbackPattern = null;
  }
}

let singleton: SourceManager | null = null;

export function getSourceManager(): SourceManager {
  if (!singleton) singleton = new SourceManager();
  return singleton;
}

if (typeof window !== "undefined") {
  (window as unknown as { __spectraMedia: typeof getSourceManager }).__spectraMedia =
    getSourceManager;
}
