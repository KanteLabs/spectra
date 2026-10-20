import { describe, expect, it } from "vitest";
import {
  accumulateKnobAngle,
  knobRawFromAngleDelta,
  knobRotationForValue,
  knobValueFromAngleDelta,
  knobValueFromDelta,
  pointerAngle,
  shortestAngleDelta,
  sliderValueFromDelta,
  isClickNotDrag,
  KNOB_FULL_TRAVEL,
} from "@/systems/interaction/pointer";
import { cycleControlId, parseKeyAction } from "@/systems/interaction/keyboard";

describe("pointer math", () => {
  it("maps knob drag to detents", () => {
    const v = knobValueFromDelta(0, 200, 0, 7, 8, 0.02);
    expect(v).toBeGreaterThan(0);
  });

  it("maps clockwise angle drag to higher detents", () => {
    const quarter = KNOB_FULL_TRAVEL / 3;
    const v = knobValueFromAngleDelta(0, quarter, 0, 9, 10);
    expect(v).toBeGreaterThan(0);
    expect(knobRawFromAngleDelta(0, quarter, 0, 9)).toBeCloseTo(3, 5);
  });

  it("rotates dial clockwise for higher values", () => {
    expect(knobRotationForValue(0, 0, 9)).toBeCloseTo(0);
    expect(knobRotationForValue(9, 0, 9)).toBeCloseTo(-KNOB_FULL_TRAVEL);
    expect(knobRotationForValue(9, 0, 9)).toBeLessThan(knobRotationForValue(0, 0, 9));
  });

  it("accumulates turn across the ±π seam without resetting", () => {
    let last = 2.8;
    let accum = 0;
    // step clockwise across the seam
    ({ lastAngle: last, angleAccum: accum } = accumulateKnobAngle(last, -2.8, accum));
    expect(accum).toBeGreaterThan(0);
    expect(accum).toBeLessThan(1);
  });

  it("unwraps angle deltas across the ±π seam", () => {
    expect(Math.abs(shortestAngleDelta(2.9, -2.9))).toBeLessThan(1);
  });

  it("computes pointer angles", () => {
    expect(pointerAngle(110, 100, 100, 100)).toBeCloseTo(0);
    expect(pointerAngle(100, 110, 100, 100)).toBeCloseTo(Math.PI / 2);
  });

  it("treats small pointer travel as a click, not a drag", () => {
    expect(isClickNotDrag(10, 10, 12, 11)).toBe(true);
    expect(isClickNotDrag(10, 10, 30, 10)).toBe(false);
  });
});

describe("keyboard", () => {
  it("leaves DOM buttons and links to native keyboard navigation", () => {
    for (const tagName of ["BUTTON", "A", "INPUT", "SELECT"]) {
      const target = { tagName, closest: () => ({ tagName }) };
      for (const key of ["Tab", "Enter", " ", "ArrowRight", "p", "Escape"]) {
        expect(parseKeyAction({ key, target } as unknown as KeyboardEvent)).toBeNull();
      }
    }
  });

  it("preserves native Tab traversal and host-owned keyboard events", () => {
    for (const event of [
      { key: "Tab" },
      { key: "p", defaultPrevented: true },
      { key: "p", ctrlKey: true },
      { key: "p", metaKey: true },
      { key: "p", altKey: true },
      { key: "Enter", target: { closest: () => ({ tagName: "BUTTON" }) } },
    ]) {
      expect(parseKeyAction(event as unknown as KeyboardEvent)).toBeNull();
    }
  });

  it("parses camera presets", () => {
    const ev = { key: "1", shiftKey: false, target: null } as unknown as KeyboardEvent;
    expect(parseKeyAction(ev)).toEqual({ type: "cameraPreset", preset: "front" });
  });

  it("cycles controls", () => {
    const a = cycleControlId(null, 1);
    const b = cycleControlId(a, 1);
    expect(a).not.toBe(b);
  });
});
