import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SourceManager, type ManagedSource } from "@/systems/media/SourceManager";

function fakeSource(
  id: string,
  heavyUpdate: boolean,
  onUpdate: () => void
): ManagedSource {
  return {
    id,
    texture: new THREE.Texture(),
    loadState: "ready",
    hasAudio: false,
    heavyUpdate,
    update: onUpdate,
    dispose: () => undefined,
  };
}

describe("SourceManager.update visibility gating", () => {
  it("skips canvas redraws for channels that are off-screen", () => {
    const mgr = new SourceManager();
    let onScreen = 0;
    let offScreen = 0;
    mgr.registerExternal(fakeSource("visible", true, () => onScreen++));
    mgr.registerExternal(fakeSource("hidden", true, () => offScreen++));

    mgr.update(1, new Set(["visible"]));

    expect(onScreen).toBe(1);
    expect(offScreen).toBe(0);
  });

  it("always advances cheap updates so video soft-trim keeps working", () => {
    const mgr = new SourceManager();
    let cheap = 0;
    mgr.registerExternal(fakeSource("clip", false, () => cheap++));

    mgr.update(1, new Set(["something-else"]));

    expect(cheap).toBe(1);
  });

  it("updates everything when no visible set is supplied", () => {
    const mgr = new SourceManager();
    let heavy = 0;
    mgr.registerExternal(fakeSource("heavy", true, () => heavy++));

    mgr.update(1);

    expect(heavy).toBe(1);
  });
});
