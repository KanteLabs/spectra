export type MainDepthEffect = "parallax" | "anaglyph" | "crtDepth" | "off";

export type ScreenId = "main" | "preview1" | "preview2" | "preview3";

export type PowerState = "off" | "starting" | "on" | "shuttingDown";

export type SignalCondition =
  | "clean"
  | "weak"
  | "tuning"
  | "noSignal"
  | "verticalHold"
  | "horizontalHold"
  | "static"
  | "testPattern";

export type SourceKind = "video" | "procedural" | "renderTarget" | "image";

export type SourceLoadState = "idle" | "loading" | "ready" | "buffering" | "error";

export interface SourceDefinition {
  id: string;
  label: string;
  kind: SourceKind;
  /** Remote or local URL for video/image sources */
  url?: string;
  /** Whether this source can provide audio */
  hasAudio?: boolean;
  /** Default color amount: 1 = full color, 0 = monochrome */
  colorAmount?: number;
  /** Optional thumbnail (blob URL) for UI lists */
  posterUrl?: string;
  /** Soft trim: loop ends at this time (seconds) for long uploads */
  playEndSec?: number;
  /** True when GPU playback is canvas-scaled down from 4K */
  displayScaled?: boolean;
}

export interface ScreenSlot {
  screenId: ScreenId;
  sourceId: string;
  powered: boolean;
  signal: SignalCondition;
  colorAmount: number;
}

export type CameraPreset =
  | "front"
  | "side"
  | "rear"
  | "top"
  | "isometric"
  | "reset"
  | "focused"
  | "mainCrt";

export type EnvironmentId = "livingRoom" | "studio";

export type QualityLevel = "ultra" | "high" | "medium" | "low" | "xr";

export type InteractionMode = "desktop" | "xr";

export type ControlKind = "button" | "knob" | "slider" | "switch" | "screen";

export interface ControlSpec {
  id: string;
  kind: ControlKind;
  label: string;
  /** Mesh / object name in the model hierarchy */
  meshName: string;
  /** Optional linked screen for preview buttons */
  screenId?: ScreenId;
  /** Slider / knob value range */
  min?: number;
  max?: number;
  step?: number;
  /** Number of detent steps for knobs */
  detents?: number;
  /** Axis for slider motion in local space */
  axis?: "x" | "y" | "z";
  /** Travel distance for sliders */
  travel?: number;
}

export interface PictureControls {
  brightness: number;
  contrast: number;
  saturation: number;
  tuning: number;
  volume: number;
  /** Shared brightness for the three preview CRTs (0–1). */
  previewLevel: number;
}

export interface CRTUniforms {
  sourceTexture: unknown;
  curvature: number;
  scanlineStrength: number;
  maskStrength: number;
  noiseStrength: number;
  colorAmount: number;
  signalQuality: number;
  time: number;
  brightness: number;
  contrast: number;
  powerProgress: number;
  rollOffset: number;
  syncDrift: number;
  vignette: number;
  rgbSeparation: number;
  interlace: number;
  softFocus: number;
}
