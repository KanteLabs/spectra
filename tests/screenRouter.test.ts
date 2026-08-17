import { describe, expect, it } from "vitest";
import {
  clearTransitionSignals,
  createDefaultRouting,
  promotePreview,
  quantizeDetent,
  setLocked,
  setScreenSource,
} from "@/systems/routing/screenRouter";

const sources = {
  main: "variety",
  preview1: "smpte",
  preview2: "productOrbit",
  preview3: "newsroom",
};

describe("screenRouter", () => {
  it("creates default routing with four screens", () => {
    const state = createDefaultRouting(sources);
    expect(state.screens.main.sourceId).toBe("variety");
    expect(state.screens.preview1.colorAmount).toBeGreaterThan(0.8);
    expect(state.activeAudioScreen).toBe("main");
    expect(state.locked).toBe(false);
  });

  it("promotes preview source to main and swaps", () => {
    const state = createDefaultRouting(sources);
    const next = promotePreview(state, "preview2");
    expect(next).not.toBeNull();
    expect(next!.screens.main.sourceId).toBe("productOrbit");
    expect(next!.screens.preview2.sourceId).toBe("variety");
    expect(next!.screens.main.signal).toBe("tuning");
  });

  it("refuses promote when locked", () => {
    const locked = setLocked(createDefaultRouting(sources), true);
    expect(promotePreview(locked, "preview1")).toBeNull();
  });

  it("assigns source when unlocked", () => {
    const state = createDefaultRouting(sources);
    const next = setScreenSource(state, "preview3", "variety");
    expect(next!.screens.preview3.sourceId).toBe("variety");
  });

  it("clears tuning transition signals", () => {
    const promoted = promotePreview(createDefaultRouting(sources), "preview1")!;
    const cleared = clearTransitionSignals(promoted);
    expect(cleared.screens.main.signal).toBe("clean");
    expect(cleared.screens.preview1.signal).toBe("clean");
  });
});

describe("quantizeDetent", () => {
  it("snaps to nearest detent", () => {
    expect(quantizeDetent(0.4, 0, 7, 8)).toBeCloseTo(0);
    expect(quantizeDetent(3.2, 0, 7, 8)).toBeCloseTo(3);
    expect(quantizeDetent(6.9, 0, 7, 8)).toBeCloseTo(7);
  });

  it("clamps to range", () => {
    expect(quantizeDetent(-10, 0, 7, 8)).toBe(0);
    expect(quantizeDetent(99, 0, 7, 8)).toBe(7);
  });
});
