import { describe, expect, it } from "vitest";
import {
  MAIN_CRT_FRAME,
  MAIN_CRT_TARGET,
  applyLevelCameraPose,
  computeMainCrtView,
  mainCrtViewDistance,
} from "@/systems/camera/mainCrtFraming";

describe("mainCrtFraming", () => {
  const fov = 40;
  const bezelAspect = MAIN_CRT_FRAME.outerW / MAIN_CRT_FRAME.outerH;

  it("at matched aspect, height and width distances agree", () => {
    const dist = mainCrtViewDistance(bezelAspect, fov, { pad: 1 });
    const tanHalf = Math.tan((fov * Math.PI) / 180 / 2);
    const expected = (MAIN_CRT_FRAME.outerH * 0.5) / tanHalf;
    expect(dist).toBeCloseTo(expected, 5);
  });

  it("narrow viewports step back so bezel width is not cropped", () => {
    const atMatch = mainCrtViewDistance(bezelAspect, fov, { pad: 1 });
    const narrow = mainCrtViewDistance(bezelAspect * 0.5, fov, { pad: 1 });
    expect(narrow).toBeGreaterThan(atMatch);
  });

  it("wide viewports keep height-limited distance (no width crop)", () => {
    const atMatch = mainCrtViewDistance(bezelAspect, fov, { pad: 1 });
    const wide = mainCrtViewDistance(16 / 9, fov, { pad: 1 });
    expect(wide).toBeCloseTo(atMatch, 5);
  });

  it("places the camera on the CRT axis looking at the bezel center", () => {
    const view = computeMainCrtView(16 / 9, 40);
    expect(view.target).toEqual([...MAIN_CRT_TARGET]);
    expect(view.position[0]).toBe(MAIN_CRT_TARGET[0]);
    expect(view.position[1]).toBe(MAIN_CRT_TARGET[1]);
    expect(view.position[2]).toBeGreaterThan(MAIN_CRT_TARGET[2]);
  });

  it("does not over-zoom vs the old fixed z=0.82 pose on 16:9", () => {
    const view = computeMainCrtView(16 / 9, 40);
    const oldDist = 0.82 - MAIN_CRT_TARGET[2];
    expect(view.position[2] - MAIN_CRT_TARGET[2]).toBeGreaterThan(oldDist);
  });

  it("keeps the camera on the CRT face normal (no XY offset → no slant)", () => {
    const view = computeMainCrtView(1.6, 40);
    expect(view.position[0]).toBe(view.target[0]);
    expect(view.position[1]).toBe(view.target[1]);
    expect(view.position[2]).toBeGreaterThan(view.target[2]);
  });

  it("levels camera.up to +Y when applying a pose", () => {
    const cam = {
      up: { x: 0.2, y: 0.8, z: 0.1, set(x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z;
      }},
      position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z;
      }},
      lookAtTarget: null as null | { x: number; y: number; z: number },
      lookAt(x: number, y: number, z: number) {
        this.lookAtTarget = { x, y, z };
      },
    };
    applyLevelCameraPose(cam, { x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 5 });
    expect(cam.up).toMatchObject({ x: 0, y: 1, z: 0 });
    expect(cam.position).toMatchObject({ x: 1, y: 2, z: 5 });
    expect(cam.lookAtTarget).toEqual({ x: 1, y: 2, z: 3 });
  });
});
