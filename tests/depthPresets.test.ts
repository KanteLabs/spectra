import { describe, expect, it } from "vitest";
import {
  DEPTH_MODE_CODE,
  MAIN_DEPTH_OPTIONS,
  depthAmountForQuality,
} from "@/systems/quality/depthPresets";

describe("depth presets", () => {
  it("defaults to glass parallax as the first listed option", () => {
    expect(MAIN_DEPTH_OPTIONS[0]?.id).toBe("parallax");
  });

  it("maps every option to a stable shader code", () => {
    expect(DEPTH_MODE_CODE.off).toBe(0);
    expect(DEPTH_MODE_CODE.parallax).toBe(1);
    expect(DEPTH_MODE_CODE.anaglyph).toBe(2);
    expect(DEPTH_MODE_CODE.crtDepth).toBe(3);
    for (const opt of MAIN_DEPTH_OPTIONS) {
      expect(DEPTH_MODE_CODE[opt.id]).toBeTypeOf("number");
    }
  });

  it("scales strength with graphics quality", () => {
    expect(depthAmountForQuality("ultra")).toBeGreaterThan(
      depthAmountForQuality("high")
    );
    expect(depthAmountForQuality("high")).toBeGreaterThan(
      depthAmountForQuality("medium")
    );
    expect(depthAmountForQuality("medium")).toBeGreaterThan(
      depthAmountForQuality("low")
    );
    expect(depthAmountForQuality("xr")).toBe(depthAmountForQuality("low"));
  });
});
