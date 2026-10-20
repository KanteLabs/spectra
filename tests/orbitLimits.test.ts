import { describe, expect, it } from "vitest";
import {
  FRONT_VIEW,
  ORBIT_SWEEP_RAD,
  ORBIT_HORIZON_POLAR,
  frontOrbitLimits,
  frontOrbitRadius,
  sphericalFromOffset,
  frontViewForAspect,
} from "@/systems/camera/orbitLimits";

describe("front orbit limits", () => {
  it("preserves the original desktop framing", () => {
    expect(frontViewForAspect(16 / 9)).toEqual(FRONT_VIEW);
  });

  it.each([320 / 568, 390 / 702, 768 / 882])("contains the cabinet at portrait aspect %s", (aspect) => {
    const view = frontViewForAspect(aspect);
    const widthAtFace = 2 * (view.position[2] - 0.3) * Math.tan(40 * Math.PI / 360) * aspect;
    expect(widthAtFace).toBeGreaterThanOrEqual(1.06 * 1.16 - 1e-8);
    expect(frontOrbitLimits(view).maxDistance).toBeCloseTo(Math.hypot(
      ...view.position.map((value, i) => value - view.target[i])
    ));
    expect(view.target).toEqual(FRONT_VIEW.target);
  });

  it("uses the starting framing as max zoom-out", () => {
    const limits = frontOrbitLimits();
    expect(limits.maxDistance).toBeCloseTo(frontOrbitRadius(), 6);
    expect(limits.minDistance).toBeLessThan(limits.maxDistance);
  });

  it("clamps yaw and pitch to about ±60° from the front pose", () => {
    const [px, py, pz] = FRONT_VIEW.position;
    const [tx, ty, tz] = FRONT_VIEW.target;
    const { phi, theta } = sphericalFromOffset(px - tx, py - ty, pz - tz);
    const limits = frontOrbitLimits();
    expect(limits.minAzimuthAngle).toBeCloseTo(theta - ORBIT_SWEEP_RAD, 6);
    expect(limits.maxAzimuthAngle).toBeCloseTo(theta + ORBIT_SWEEP_RAD, 6);
    expect(limits.minPolarAngle).toBeCloseTo(
      Math.max(0.12, phi - ORBIT_SWEEP_RAD),
      6
    );
    expect(limits.maxPolarAngle).toBeLessThanOrEqual(ORBIT_HORIZON_POLAR);
    expect(limits.maxPolarAngle - limits.minPolarAngle).toBeLessThan(
      ORBIT_SWEEP_RAD * 2 + 1e-6
    );
  });
});
