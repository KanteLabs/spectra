/** Client-side prep for user uploads: posters, soft trim, image downscale. */

export const MAX_USER_MEDIA = 8;
export const MAX_USER_MEDIA_BYTES = 200 * 1024 * 1024;
/** Long-edge cap for CRT display (GPU sanity for 4K sources). */
export const DISPLAY_MAX_EDGE = 1280;
/** Soft-trim long videos to this many seconds (loop window). */
export const VIDEO_SOFT_TRIM_SEC = 10 * 60;
/** Image long-edge cap when storing stills. */
export const IMAGE_MAX_EDGE = 1920;

export interface ProcessedUserMedia {
  kind: "video" | "image";
  /** Blob used for playback (may be downscaled image; video keeps original). */
  playbackBlob: Blob;
  mime: string;
  label: string;
  posterBlob?: Blob;
  /** Soft trim end time for long videos */
  playEndSec?: number;
  /** Hint that runtime should canvas-scale video frames */
  displayScaled: boolean;
  hasAudioHint: boolean;
}

function labelFromFileName(name: string, kind: "video" | "image"): string {
  const fallback = kind === "image" ? "Uploaded still" : "Uploaded video";
  const base = name.replace(/\.[^.]+$/, "").trim() || fallback;
  return base.length > 42 ? `${base.slice(0, 40)}…` : base;
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      type,
      quality
    );
  });
}

function fitSize(
  width: number,
  height: number,
  maxEdge: number
): { w: number; h: number; scaled: boolean } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { w: width, h: height, scaled: false };
  const s = maxEdge / edge;
  return {
    w: Math.max(1, Math.round(width * s)),
    h: Math.max(1, Math.round(height * s)),
    scaled: true,
  };
}

async function processImage(file: File): Promise<ProcessedUserMedia> {
  const img = await loadImageElement(file);
  const { w, h, scaled } = fitSize(img.naturalWidth, img.naturalHeight, IMAGE_MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const playbackBlob = await canvasToBlob(canvas, "image/jpeg", 0.88);

  // Smaller poster for lists
  const thumb = fitSize(w, h, 320);
  const tCanvas = document.createElement("canvas");
  tCanvas.width = thumb.w;
  tCanvas.height = thumb.h;
  tCanvas.getContext("2d")!.drawImage(canvas, 0, 0, thumb.w, thumb.h);
  const posterBlob = await canvasToBlob(tCanvas, "image/jpeg", 0.75);

  return {
    kind: "image",
    playbackBlob,
    mime: "image/jpeg",
    label: labelFromFileName(file.name, "image"),
    posterBlob,
    displayScaled: scaled,
    hasAudioHint: false,
  };
}

function loadVideoMetadata(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video"));
    };
    video.src = url;
  });
}

async function extractPoster(video: HTMLVideoElement): Promise<Blob | undefined> {
  try {
    const seekTo = Math.min(0.25, Math.max(0, (video.duration || 1) * 0.05));
    if (video.currentTime !== seekTo) {
      await new Promise<void>((resolve) => {
        const onSeek = () => {
          video.removeEventListener("seeked", onSeek);
          resolve();
        };
        video.addEventListener("seeked", onSeek);
        video.currentTime = seekTo;
      });
    }
    const { w, h } = fitSize(
      video.videoWidth || 640,
      video.videoHeight || 360,
      320
    );
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    return await canvasToBlob(canvas, "image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}

async function processVideo(file: File): Promise<ProcessedUserMedia> {
  const video = await loadVideoMetadata(file);
  const srcUrl = video.src;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const edge = Math.max(video.videoWidth || 0, video.videoHeight || 0);
  const displayScaled = edge > DISPLAY_MAX_EDGE;
  const playEndSec =
    duration > VIDEO_SOFT_TRIM_SEC ? VIDEO_SOFT_TRIM_SEC : undefined;

  const posterBlob = await extractPoster(video);
  URL.revokeObjectURL(srcUrl);
  video.removeAttribute("src");
  video.load();

  return {
    kind: "video",
    // Keep original file for audio fidelity; scale at draw time if 4K
    playbackBlob: file,
    mime: file.type || "video/mp4",
    label: labelFromFileName(file.name, "video"),
    posterBlob,
    playEndSec,
    displayScaled,
    hasAudioHint: true,
  };
}

export async function processUserMediaFile(file: File): Promise<ProcessedUserMedia> {
  if (file.size > MAX_USER_MEDIA_BYTES) {
    throw new Error("File is too large (max 200 MB)");
  }
  if (file.type.startsWith("image/")) {
    return processImage(file);
  }
  if (file.type.startsWith("video/")) {
    return processVideo(file);
  }
  throw new Error("Please choose a video or image file");
}
