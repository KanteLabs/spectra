/** Shared front pose + free-orbit clamps. Keep CameraRig / Canvas in sync. */

export const FRONT_VIEW = {
  position: [0, 1.12, 1.86] as [number, number, number],
  target: [0, 1.05, 0.08] as [number, number, number],
};

/** Keep the approved desktop pose; back away only when cabinet width would crop. */
export function frontViewForAspect(aspect: number, fovDeg = 40): typeof FRONT_VIEW {
  const safeAspect = Math.max(0.2, aspect || 1);
  // Cabinet trim is 1.06 m wide; reserve space around its front controls (z < .3).
  const requiredZ = 0.3 + (1.06 * 1.16) / (2 * Math.tan(fovDeg * Math.PI / 360) * safeAspect);
  const scale = Math.max(1, (requiredZ - FRONT_VIEW.target[2]) / (FRONT_VIEW.position[2] - FRONT_VIEW.target[2]));
  return {
    position: FRONT_VIEW.position.map((value, i) => FRONT_VIEW.target[i] + (value - FRONT_VIEW.target[i]) * scale) as [number, number, number],
    target: [...FRONT_VIEW.target],
  };
}

/** ±60° from the starting front spherical. */
export const ORBIT_SWEEP_RAD = Math.PI / 3;

/** Just above the floor plane so the camera cannot go under the set. */
export const ORBIT_HORIZON_POLAR = Math.PI * 0.49;

export interface OrbitLimitSet {
  minDistance: number;
  maxDistance: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export function sphericalFromOffset(
  dx: number,
  dy: number,
  dz: number
): { radius: number; phi: number; theta: number } {
  const radius = Math.hypot(dx, dy, dz);
  const phi = Math.acos(
    Math.min(1, Math.max(-1, dy / Math.max(radius, 1e-8)))
  );
  const theta = Math.atan2(dx, dz);
  return { radius, phi, theta };
}

/** Starting camera-to-target distance — also the farthest free-orbit dolly. */
export function frontOrbitRadius(view = FRONT_VIEW): number {
  const [px, py, pz] = view.position;
  const [tx, ty, tz] = view.target;
  return Math.hypot(px - tx, py - ty, pz - tz);
}

/**
 * Free-look around the default front pose: ±60° yaw/pitch, cannot dolly
 * farther out than the starting framing.
 */
export function frontOrbitLimits(view = FRONT_VIEW): OrbitLimitSet {
  const [px, py, pz] = view.position;
  const [tx, ty, tz] = view.target;
  const { radius, phi, theta } = sphericalFromOffset(px - tx, py - ty, pz - tz);
  return {
    minDistance: Math.min(0.45, radius * 0.35),
    maxDistance: radius,
    minAzimuthAngle: theta - ORBIT_SWEEP_RAD,
    maxAzimuthAngle: theta + ORBIT_SWEEP_RAD,
    minPolarAngle: Math.max(0.12, phi - ORBIT_SWEEP_RAD),
    maxPolarAngle: Math.min(ORBIT_HORIZON_POLAR, phi + ORBIT_SWEEP_RAD),
  };
}

/** Side / rear / top / iso inspection — no home-cone clamp. */
export const INSPECT_ORBIT_LIMITS: OrbitLimitSet = {
  minDistance: 0.4,
  maxDistance: 6,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  minPolarAngle: 0,
  maxPolarAngle: ORBIT_HORIZON_POLAR,
};
