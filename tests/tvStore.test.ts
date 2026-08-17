import { describe, expect, it, beforeEach } from "vitest";
import { useTvStore } from "@/state/tvStore";
import { SIGNAL_PRESETS, getSignalUniforms } from "@/shaders/crt/signalPresets";

describe("tvStore transitions", () => {
  beforeEach(() => {
    useTvStore.getState().reset();
  });

  it("toggles power into starting state", () => {
    useTvStore.getState().togglePower();
    expect(useTvStore.getState().power).toBe("starting");
  });

  it("promotes preview and sets transition", () => {
    const ok = useTvStore.getState().promote("preview1");
    expect(ok).toBe(true);
    const s = useTvStore.getState();
    expect(s.screens.main.sourceId).toBe("smpte");
    expect(s.transitionActive).toBe(true);
  });

  it("honors lock", () => {
    useTvStore.getState().setLock(true);
    expect(useTvStore.getState().promote("preview2")).toBe(false);
  });

  it("updates picture controls", () => {
    useTvStore.getState().setPicture({ brightness: 0.9, volume: 0.2 });
    expect(useTvStore.getState().picture.brightness).toBe(0.9);
    expect(useTvStore.getState().picture.volume).toBe(0.2);
  });
});

describe("signal presets", () => {
  it("maps every condition to uniforms", () => {
    for (const key of Object.keys(SIGNAL_PRESETS) as (keyof typeof SIGNAL_PRESETS)[]) {
      const u = getSignalUniforms(key, false);
      expect(u.signalQuality).toBeGreaterThanOrEqual(0);
      expect(u.noiseStrength).toBeGreaterThanOrEqual(0);
    }
  });

  it("reduces flicker when requested", () => {
    const full = getSignalUniforms("static", false);
    const reduced = getSignalUniforms("static", true);
    expect(reduced.interlace).toBeLessThan(full.interlace);
    expect(reduced.noiseStrength).toBeLessThan(full.noiseStrength);
  });
});
