import { create } from "zustand";
import type {
  CameraPreset,
  EnvironmentId,
  InteractionMode,
  MainDepthEffect,
  QualityLevel,
} from "@/types";
import { detectDeviceQuality } from "@/systems/quality/qualityConfig";

export interface UiStore {
  mode: InteractionMode;
  cameraPreset: CameraPreset;
  environment: EnvironmentId;
  quality: QualityLevel;
  /** Hardware ceiling from boot detect — adaptive quality will not exceed this. */
  qualityCeiling: QualityLevel;
  inspectionMode: boolean;
  explodedProgress: number;
  cabinetTransparent: boolean;
  rearRemoved: boolean;
  cinemaScreenId: string | null;
  reducedMotion: boolean;
  reducedFlicker: boolean;
  highContrast: boolean;
  panelOpen: boolean;
  xrSupported: boolean;
  seatedMode: boolean;
  smoothTurn: boolean;
  focusControlId: string | null;
  warningAcknowledged: boolean;
  showLabels: boolean;
  /** Fake 3D look on the main CRT only. */
  mainDepthEffect: MainDepthEffect;

  setMode: (mode: InteractionMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setEnvironment: (env: EnvironmentId) => void;
  setQuality: (q: QualityLevel) => void;
  setQualityCeiling: (q: QualityLevel) => void;
  setInspectionMode: (on: boolean) => void;
  setExplodedProgress: (n: number) => void;
  setCabinetTransparent: (on: boolean) => void;
  setRearRemoved: (on: boolean) => void;
  setCinemaScreen: (id: string | null) => void;
  setReducedMotion: (on: boolean) => void;
  setReducedFlicker: (on: boolean) => void;
  setHighContrast: (on: boolean) => void;
  setPanelOpen: (on: boolean) => void;
  setXrSupported: (on: boolean) => void;
  setSeatedMode: (on: boolean) => void;
  setSmoothTurn: (on: boolean) => void;
  setFocusControlId: (id: string | null) => void;
  setWarningAcknowledged: (on: boolean) => void;
  setShowLabels: (on: boolean) => void;
  setMainDepthEffect: (effect: MainDepthEffect) => void;
  setMainCrtZoom: (zoomed: boolean) => void;
}

function detectReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const bootQuality: QualityLevel =
  typeof window !== "undefined" ? detectDeviceQuality() : "medium";

export const useUiStore = create<UiStore>((set) => ({
  mode: "desktop",
  cameraPreset: "front",
  environment: "livingRoom",
  quality: bootQuality,
  qualityCeiling: bootQuality === "xr" ? "medium" : bootQuality,
  inspectionMode: false,
  explodedProgress: 0,
  cabinetTransparent: false,
  rearRemoved: false,
  cinemaScreenId: null,
  reducedMotion: typeof window !== "undefined" ? detectReducedMotion() : false,
  reducedFlicker: false,
  highContrast: false,
  panelOpen: false,
  xrSupported: false,
  seatedMode: false,
  smoothTurn: false,
  focusControlId: null,
  warningAcknowledged: false,
  showLabels: false,
  mainDepthEffect: "parallax",

  setMode: (mode) => set({ mode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setEnvironment: (environment) => set({ environment }),
  setQuality: (quality) => set({ quality }),
  setQualityCeiling: (qualityCeiling) => set({ qualityCeiling }),
  setInspectionMode: (inspectionMode) => set({ inspectionMode }),
  setExplodedProgress: (explodedProgress) => set({ explodedProgress }),
  setCabinetTransparent: (cabinetTransparent) => set({ cabinetTransparent }),
  setRearRemoved: (rearRemoved) => set({ rearRemoved }),
  setCinemaScreen: (cinemaScreenId) => set({ cinemaScreenId }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setReducedFlicker: (reducedFlicker) => set({ reducedFlicker }),
  setHighContrast: (highContrast) => set({ highContrast }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setXrSupported: (xrSupported) => set({ xrSupported }),
  setSeatedMode: (seatedMode) => set({ seatedMode }),
  setSmoothTurn: (smoothTurn) => set({ smoothTurn }),
  setFocusControlId: (focusControlId) => set({ focusControlId }),
  setWarningAcknowledged: (warningAcknowledged) => set({ warningAcknowledged }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setMainDepthEffect: (mainDepthEffect) => set({ mainDepthEffect }),
  /** Toggle main-CRT reading zoom + focus in one update (avoids double camera tweens). */
  setMainCrtZoom: (zoomed) =>
    set(
      zoomed
        ? { cameraPreset: "mainCrt", focusControlId: "screenMain" }
        : { cameraPreset: "front", focusControlId: null }
    ),
}));

/** Live-test / CDP hook — not part of the product UI. */
if (typeof window !== "undefined") {
  (window as unknown as { __spectraUi: typeof useUiStore }).__spectraUi =
    useUiStore;
}
