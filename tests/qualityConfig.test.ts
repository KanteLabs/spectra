import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUALITY_CONFIGS,
  TIER_ABOVE,
  TIER_BELOW,
  clampQualityToCeiling,
  detectDeviceQuality,
  qualityRank,
  renderScaleFor,
} from "@/systems/quality/qualityConfig";

describe("qualityRank / clampQualityToCeiling", () => {
  it("orders low < medium < high < ultra", () => {
    expect(qualityRank("low")).toBeLessThan(qualityRank("medium"));
    expect(qualityRank("medium")).toBeLessThan(qualityRank("high"));
    expect(qualityRank("high")).toBeLessThan(qualityRank("ultra"));
    expect(qualityRank("xr")).toBe(qualityRank("low"));
  });

  it("never raises above the ceiling", () => {
    expect(clampQualityToCeiling("ultra", "high")).toBe("high");
    expect(clampQualityToCeiling("high", "medium")).toBe("medium");
    expect(clampQualityToCeiling("medium", "low")).toBe("low");
    expect(clampQualityToCeiling("low", "high")).toBe("low");
    expect(clampQualityToCeiling("ultra", "ultra")).toBe("ultra");
  });

  it("keeps xr as xr", () => {
    expect(clampQualityToCeiling("xr", "high")).toBe("xr");
  });
});

describe("tier ladder", () => {
  it("steps down without skipping or wrapping", () => {
    expect(TIER_BELOW.ultra).toBe("high");
    expect(TIER_BELOW.high).toBe("medium");
    expect(TIER_BELOW.medium).toBe("low");
    expect(TIER_BELOW.low).toBe("low");
  });

  it("steps up without skipping or wrapping", () => {
    expect(TIER_ABOVE.low).toBe("medium");
    expect(TIER_ABOVE.medium).toBe("high");
    expect(TIER_ABOVE.high).toBe("ultra");
    expect(TIER_ABOVE.ultra).toBe("ultra");
  });

  it("leaves xr out of the ladder", () => {
    expect(TIER_BELOW.xr).toBe("xr");
    expect(TIER_ABOVE.xr).toBe("xr");
  });
});

describe("renderScaleFor", () => {
  it("supersamples only on ultra", () => {
    expect(renderScaleFor("ultra", 1)).toBeCloseTo(1.25);
    expect(renderScaleFor("high", 1)).toBe(1);
  });

  it("respects the tier pixel ratio cap", () => {
    expect(renderScaleFor("ultra", 3)).toBe(3);
    expect(renderScaleFor("high", 3)).toBe(2);
    expect(renderScaleFor("low", 3)).toBe(1);
  });
});

describe("QUALITY_CONFIGS tiers", () => {
  it("disables heavy post on low and xr", () => {
    for (const tier of ["low", "xr"] as const) {
      const cfg = QUALITY_CONFIGS[tier];
      expect(cfg.enablePost).toBe(false);
      expect(cfg.shadows).toBe(false);
      expect(cfg.crt.softFocusQuality).toBe(0);
    }
  });

  it("enables richer CRT features on high", () => {
    const high = QUALITY_CONFIGS.high;
    expect(high.enableBloom).toBe(true);
    expect(high.enableDof).toBe(true);
    expect(high.crt.maskMode).toBe(1);
    expect(high.crt.softFocusQuality).toBeGreaterThanOrEqual(1);
    expect(high.crt.softFocus).toBeLessThan(0.08);
    expect(high.crt.phosphorGlow).toBeGreaterThan(QUALITY_CONFIGS.low.crt.phosphorGlow);
  });

  it("pushes ultra past high where supersample / RT matter", () => {
    const ultra = QUALITY_CONFIGS.ultra;
    const high = QUALITY_CONFIGS.high;
    expect(ultra.supersample).toBeGreaterThan(high.supersample);
    expect(ultra.pixelRatioMax).toBeGreaterThan(high.pixelRatioMax);
    expect(ultra.renderTargetSize).toBeGreaterThan(high.renderTargetSize);
    // Soft-focus stays mild (4-tap) so HUD text survives supersample
    expect(ultra.crt.softFocusQuality).toBeLessThanOrEqual(1);
    expect(ultra.crt.softFocus).toBeLessThan(0.08);
    expect(ultra.crt.phosphorSpread).toBe(0);
    expect(ultra.softShadows).toBe(true);
  });

  it("keeps phosphor neighborhood taps off on all tiers", () => {
    for (const tier of ["ultra", "high", "medium", "low", "xr"] as const) {
      expect(QUALITY_CONFIGS[tier].crt.phosphorSpread).toBe(0);
    }
  });
});

describe("detectDeviceQuality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns medium when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(detectDeviceQuality()).toBe("medium");
  });

  /** Minimal WebGL stub whose UNMASKED_RENDERER_WEBGL reports `renderer`. */
  function stubGpu(
    renderer: string,
    opts: { cores?: number; mem?: number; dpr?: number; mobile?: boolean } = {}
  ) {
    const gl = {
      MAX_TEXTURE_SIZE: 0x0d33,
      getParameter: (p: number) => (p === 0x0d33 ? 16384 : renderer),
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
    };
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => gl }),
    });
    vi.stubGlobal("navigator", {
      userAgent: opts.mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      hardwareConcurrency: opts.cores ?? 16,
      deviceMemory: opts.mem ?? 16,
      connection: undefined,
    });
    vi.stubGlobal("window", {
      devicePixelRatio: opts.dpr ?? 1,
      matchMedia: () => ({ matches: false }),
    });
  }

  it("scores a flagship desktop GPU as ultra", () => {
    stubGpu("NVIDIA GeForce RTX 5090");
    expect(detectDeviceQuality()).toBe("ultra");
  });

  it("keeps a mainstream desktop GPU at high", () => {
    stubGpu("NVIDIA GeForce RTX 4060 Laptop GPU");
    expect(detectDeviceQuality()).toBe("high");
  });

  it("does not hand ultra to a low core count machine", () => {
    stubGpu("NVIDIA GeForce RTX 5090", { cores: 4 });
    expect(detectDeviceQuality()).toBe("high");
  });

  it("scores mobile + save-data as low", () => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null }),
    });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      hardwareConcurrency: 4,
      deviceMemory: 2,
      connection: { saveData: true, effectiveType: "3g" },
    });
    vi.stubGlobal("window", {
      devicePixelRatio: 3,
      matchMedia: () => ({ matches: false }),
    });

    expect(detectDeviceQuality()).toBe("low");
  });
});
