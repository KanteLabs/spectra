import { describe, expect, it } from "vitest";
import {
  CONTROL_STRIP,
  PREVIEW_BANK,
  previewBankCenters,
  previewBankClearance,
} from "@/model/parts/crtAssembly";

describe("preview bank layout", () => {
  it("spaces the three preview bezels evenly", () => {
    const [c1, c2, c3] = previewBankCenters();
    const spacing = PREVIEW_BANK.outerW + PREVIEW_BANK.gap;
    expect(c2 - c1).toBeCloseTo(spacing, 6);
    expect(c3 - c2).toBeCloseTo(spacing, 6);
  });

  it("keeps a positive clearance to the control strip", () => {
    expect(previewBankClearance()).toBeGreaterThanOrEqual(0.04);
  });

  it("fits the control strip inside the cabinet half-width", () => {
    const right = CONTROL_STRIP.panelX + CONTROL_STRIP.panelW * 0.5;
    expect(right).toBeLessThanOrEqual(0.52);
  });
});
