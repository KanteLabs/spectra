import { quantizeDetent } from "@/systems/routing/screenRouter";

export interface PointerCaptureState {
  active: boolean;
  controlId: string | null;
  kind: "knob" | "slider" | "button" | "switch" | null;
  startX: number;
  startY: number;
  startValue: number;
  /** Knob angular drag: screen-space pivot and accumulated turn */
  pivotX: number;
  pivotY: number;
  startAngle: number;
  lastAngle: number;
  /** Total clockwise radians turned since pointer-down (unwrapped). */
  angleAccum: number;
  startRotation: number;
  pointerId: number;
}

export function createPointerCapture(): PointerCaptureState {
  return {
    active: false,
    controlId: null,
    kind: null,
    startX: 0,
    startY: 0,
    startValue: 0,
    pivotX: 0,
    pivotY: 0,
    startAngle: 0,
    lastAngle: 0,
    angleAccum: 0,
    startRotation: 0,
    pointerId: -1,
  };
}

/** Full mechanical travel of the main channel knob (radians). */
export const KNOB_FULL_TRAVEL = Math.PI * 1.5;

/** Screen-space angle from pivot to pointer (y-down coords; increases clockwise). */
export function pointerAngle(
  clientX: number,
  clientY: number,
  pivotX: number,
  pivotY: number
): number {
  return Math.atan2(clientY - pivotY, clientX - pivotX);
}

/** Minimum screen distance from knob center before angular samples count. */
export const KNOB_ANGLE_DEADZONE_PX = 10;

/** Shortest signed delta from a0 → a1 in radians, range (-π, π]. */
export function shortestAngleDelta(a0: number, a1: number): number {
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Advance accumulated clockwise turn from the previous sample.
 * Uses shortest step between frames so crossing ±π never resets the drag.
 */
export function accumulateKnobAngle(
  lastAngle: number,
  nextAngle: number,
  angleAccum: number
): { lastAngle: number; angleAccum: number } {
  return {
    lastAngle: nextAngle,
    angleAccum: angleAccum + shortestAngleDelta(lastAngle, nextAngle),
  };
}

/**
 * Knob: clockwise screen drag raises the value (classic radio feel).
 * angleDeltaRad is from shortestAngleDelta (positive = clockwise in y-down space).
 */
export function knobValueFromAngleDelta(
  startValue: number,
  angleDeltaRad: number,
  min: number,
  max: number,
  detents: number,
  fullTravelRad = KNOB_FULL_TRAVEL
): number {
  const range = Math.max(1e-6, max - min);
  const raw = startValue + (angleDeltaRad / fullTravelRad) * range;
  return quantizeDetent(raw, min, max, detents);
}

/** Continuous (unquantized) knob value for smooth dial visuals while dragging. */
export function knobRawFromAngleDelta(
  startValue: number,
  angleDeltaRad: number,
  min: number,
  max: number,
  fullTravelRad = KNOB_FULL_TRAVEL
): number {
  const range = Math.max(1e-6, max - min);
  const raw = startValue + (angleDeltaRad / fullTravelRad) * range;
  return Math.min(max, Math.max(min, raw));
}

/** Map channel value → local Z rotation (clockwise for higher channels). */
export function knobRotationForValue(
  value: number,
  min: number,
  max: number,
  fullTravelRad = KNOB_FULL_TRAVEL
): number {
  const range = Math.max(1e-6, max - min);
  return -((value - min) / range) * fullTravelRad;
}

/** @deprecated Prefer knobValueFromAngleDelta for turning motion. */
export function knobValueFromDelta(
  startValue: number,
  deltaX: number,
  min: number,
  max: number,
  detents: number,
  sensitivity = 0.02
): number {
  const raw = startValue + deltaX * sensitivity;
  return quantizeDetent(raw, min, max, detents);
}

/** Slider: vertical drag maps to 0..1 along travel. */
export function sliderValueFromDelta(
  startValue: number,
  deltaY: number,
  min: number,
  max: number,
  sensitivity = 0.005
): number {
  const raw = startValue - deltaY * sensitivity;
  return Math.min(max, Math.max(min, raw));
}
