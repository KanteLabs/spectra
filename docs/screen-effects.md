# Adding screen effects

CRT look is driven by GLSL in [`src/shaders/crt/`](../src/shaders/crt/).

## Uniforms

| Uniform | Role |
| --- | --- |
| `curvature` | Barrel / convex glass |
| `scanlineStrength` | Horizontal scanlines |
| `maskStrength` | Aperture grille |
| `maskMode` | 0 = mono grille, 1 = RGB aperture stripe |
| `noiseStrength` | Snow / grain |
| `colorAmount` | 1 = color, 0 = mono |
| `signalQuality` | Overall fidelity |
| `rollOffset` / `syncDrift` | Hold failures |
| `powerProgress` | Startup / shutdown |
| `phosphorGlow` | In-shader bloom (cheap when post bloom is off) |
| `phosphorSpread` | Neighbour halo radius (kept at 0 — extra taps were too expensive with 4 CRTs) |
| `glassSpec` | Glass specular / fresnel |
| `softFocus` / `softFocusQuality` | Soft focus strength + tap count (0 / 4-tap / 9-tap; main CRT only at runtime) |
| `depthMode` | Main CRT fake 3D: 0 off · 1 glass parallax · 2 anaglyph · 3 CRT depth |
| `depthAmount` | Strength of the depth preset (scaled by graphics tier) |

## Signal presets

Edit [`signalPresets.ts`](../src/shaders/crt/signalPresets.ts) to add a new `SignalCondition`. Wire it into the Controls panel select list in `ControlPanel.tsx` and the `SignalCondition` union in `src/types/index.ts`.

## Quality tiers

Device probe (`detectDeviceQuality` in `qualityConfig.ts`) scores mobile, cores, `deviceMemory`, Save-Data / network, reduced motion, WebGL renderer / max texture, and DPR. Result becomes `qualityCeiling`.

`ultra` is gated on more than score: it needs a recognised desktop-class GPU (`ULTRA_CLASS_GPU`) and at least 8 hardware threads, because it renders above native resolution. A high-scoring laptop stays on `high`.

| Tier | CRT extras | Post / scene |
| --- | --- | --- |
| **ultra** | RGB mask, mild 4-tap soft focus (main; off when CRT-zoomed), 1.25× supersample | Bloom, DoF (off when CRT-zoomed), grain, MSAA 4, 2K soft shadows (cap DPR 3) |
| **high** | RGB mask, mild 4-tap soft focus (main; off when CRT-zoomed), strong phosphor + glass | Bloom, DoF (off when CRT-zoomed), grain, MSAA 4, 2K soft shadows, DPR ≤ 2 |
| **medium** | RGB mask, 4-tap soft focus (main) | Bloom + grain, no DoF, 1K shadows, DPR ≤ 1.5 |
| **low** | Mono grille, no soft focus, light phosphor | No post, no shadows, simplified env, DPR 1 |
| **xr** | Same cheap CRT as low | No post / shadows (headset budget) |

Render resolution comes from `renderScaleFor(quality, devicePixelRatio)` = `min(dpr × supersample, pixelRatioMax)`. Supersampling is the cheapest fix for scanline and aperture-mask aliasing, and it is the first thing `AdaptiveQuality` gives back if frames get expensive.

`applyQualityTier` in `CRTScreenMaterial.ts` applies `QUALITY_CONFIGS[quality].crt` uniforms. Preview CRTs force `softFocusQuality = 0` each frame. One fragment program for all tiers — features are gated by uniforms, not `#ifdef` swaps.

Physical CRT assemblies use a **hollow bezel lip** with rounded-rect glass overlapping the opening **from the front**, so the raster seals the aperture (a recessed glass left a dark tube strip that read as top/bottom letterbox). Shader `curveUV` applies mild barrel + uniform overscan (scale `|c|` down ~4%).

`AdaptiveQuality` walks one rung at a time via `TIER_BELOW` / `TIER_ABOVE`: it drops when FPS stays &lt; ~26 for ~1.6s and recovers toward `qualityCeiling` when FPS stays &gt; ~52 for ~4.5s.

## Main CRT depth presets

Fake 3D is **main screen only** (`uiStore.mainDepthEffect`). Previews stay flat.

| Preset | Look |
| --- | --- |
| **parallax** (default) | View-dependent UV shift — picture sits behind curved glass |
| **anaglyph** | Red/cyan stereo offset of the same frame |
| **crtDepth** | Edge chroma + soft focus grow with radius; slight center pull-in |
| **off** | Flat picture plane |

Strength comes from `depthAmountForQuality` so low/XR keep a light touch. Change via Controls → Picture & sound → Main screen depth.

## Desktop bloom

Bloom is applied only outside XR via `@react-three/postprocessing` in `Experience.tsx`. Prefer emissive CRT / `phosphorGlow` over heavy screen-space effects in immersive mode or on low tier.
