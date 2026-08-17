import { describe, expect, it } from "vitest";
import type { BufferGeometry } from "three";
import {
  clampToRoundedRect,
  crtGlassPlane,
} from "@/model/parts/geometry";

describe("crtGlassPlane", () => {
  it("subdivides and bakes a size-scaled center-forward dome", () => {
    const geo = crtGlassPlane(0.4, 0.3, 0.03, 28, 20, 0.55);
    const pos = geo.attributes.position;
    expect(pos.count).toBe(29 * 21);

    let zMin = Infinity;
    let zMax = -Infinity;
    let centerZ = 0;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
      if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getY(i)) < 1e-6) {
        centerZ = z;
      }
    }
    // min(w,h)*0.55*0.14 = 0.0231
    expect(zMax - zMin).toBeCloseTo(0.3 * 0.55 * 0.14, 4);
    expect(centerZ).toBeCloseTo(zMax, 5);
    expect(zMin).toBeCloseTo(0, 5);
    geo.dispose();
  });

  it("keeps small tubes milder than large ones", () => {
    const main = crtGlassPlane(0.7, 0.5, 0.04, 16, 12, 0.55);
    const preview = crtGlassPlane(0.2, 0.15, 0.02, 16, 12, 0.55);
    const span = (geo: BufferGeometry) => {
      const pos = geo.attributes.position;
      let zMin = Infinity;
      let zMax = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
      return zMax - zMin;
    };
    expect(span(preview)).toBeLessThan(span(main) * 0.45);
    main.dispose();
    preview.dispose();
  });

  it("rounds corner outline to match the bezel aperture", () => {
    const w = 0.4;
    const h = 0.3;
    const r = 0.04;
    const geo = crtGlassPlane(w, h, r, 20, 14, 0);
    const pos = geo.attributes.position;
    const ix = w * 0.5 - r;
    const iy = h * 0.5 - r;
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const ax = Math.abs(x);
      const ay = Math.abs(y);
      if (ax > ix && ay > iy) {
        checked++;
        const cx = x < 0 ? -ix : ix;
        const cy = y < 0 ? -iy : iy;
        expect(Math.hypot(x - cx, y - cy)).toBeLessThanOrEqual(r + 1e-5);
      }
    }
    expect(checked).toBeGreaterThan(0);
    geo.dispose();
  });
});

describe("clampToRoundedRect", () => {
  it("pulls outside corner points onto the arc", () => {
    const [x, y] = clampToRoundedRect(0.2, 0.15, 0.4, 0.3, 0.05);
    const ix = 0.2 - 0.05;
    const iy = 0.15 - 0.05;
    expect(Math.hypot(x - ix, y - iy)).toBeCloseTo(0.05, 5);
  });
});
