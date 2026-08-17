/**
 * Aspect-aware framing for the main-CRT zoom preset.
 * Contain-fits the bezel in the viewport so resolution/aspect changes
 * never over-crop the tube face.
 */

/** Keep in sync with CameraRig preset ease duration. */
export const CAMERA_PRESET_MS = 1050;

export type Vec3 = [number, number, number];

/** Cabinet body Y in `buildSpectraModel` (CRT local coords sit on top). */
export const CABINET_BODY_Y = 0.78;

/** Matches `buildMainCRT` outer bezel. */
export const MAIN_CRT_FRAME = {
  localCx: -0.12,
  localCy: 0.42,
  /** Approx glass / orbit face Z in world (body-local ~0.225). */
  faceZ: 0.24,
  outerW: 0.72,
  outerH: 0.52,
} as const;

export const MAIN_CRT_TARGET: Vec3 = [
  MAIN_CRT_FRAME.localCx,
  CABINET_BODY_Y + MAIN_CRT_FRAME.localCy,
  MAIN_CRT_FRAME.faceZ,
];

export interface MainCrtView {
  position: Vec3;
  target: Vec3;
}

/**
 * Distance along +Z from the CRT face so the full bezel is visible
 * (contain) given vertical FOV and canvas aspect.
 */
export function mainCrtViewDistance(
  aspect: number,
  fovDeg: number,
  opts?: { pad?: number; outerW?: number; outerH?: number }
): number {
  const pad = opts?.pad ?? 1.02;
  const outerW = opts?.outerW ?? MAIN_CRT_FRAME.outerW;
  const outerH = opts?.outerH ?? MAIN_CRT_FRAME.outerH;
  const safeAspect = Math.max(0.2, aspect || 1);
  const vFov = (fovDeg * Math.PI) / 180;
  const tanHalf = Math.tan(vFov * 0.5);
  const halfH = (outerH * pad) * 0.5;
  const halfW = (outerW * pad) * 0.5;
  const distForHeight = halfH / tanHalf;
  const distForWidth = halfW / (tanHalf * safeAspect);
  return Math.max(distForHeight, distForWidth);
}

/** Camera pose looking straight at the main CRT, bezel contain-fitted. */
export function computeMainCrtView(
  aspect: number,
  fovDeg: number,
  opts?: { pad?: number }
): MainCrtView {
  const target = MAIN_CRT_TARGET;
  const dist = mainCrtViewDistance(aspect, fovDeg, opts);
  return {
    position: [target[0], target[1], target[2] + dist],
    target: [target[0], target[1], target[2]],
  };
}

/**
 * Apply an axis-aligned pose: world-up stays +Y so the CRT bezel is square
 * to the browser (no leftover orbit roll / damping slant).
 */
export function applyLevelCameraPose(
  camera: {
    up: { set: (x: number, y: number, z: number) => void };
    position: { set: (x: number, y: number, z: number) => void };
    lookAt: (x: number, y: number, z: number) => void;
  },
  target: { x: number; y: number; z: number },
  position: { x: number; y: number; z: number }
): void {
  camera.up.set(0, 1, 0);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(target.x, target.y, target.z);
}
