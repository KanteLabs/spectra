# Spectra behavior invariants

Agent-facing contract for Nordmende Spectra. Prefer changing code to match these rules over “simplifying” away a behavior. When refactoring media, routing, camera, or controls, run `npm test` and update tests if the contract intentionally changes.

## Product shape

- Interactive 1973 Nordmende Spectra Color Studio: one main CRT + three preview CRTs.
- Desktop: R3F scene + DOM control panel. XR cinema is session-gated only (no floating desktop cinema plane).
- Built-in channels are procedural / render-target. User media is local (blob + IndexedDB).

## Screens & routing

- Four slots: `main`, `preview1`, `preview2`, `preview3`.
- Promote swaps main ↔ preview source. Lock blocks promote/assign.
- Channel dial bank = built-in catalog ids **then** user upload ids (`buildChannelBankIds` / `getChannelBankIds`).
- Assigning main (including uploads) must sync `channelBank` to that source’s bank index so the knob does not “lose” uploads.

## Media playback (regression-prone)

**Invariant — multi-CRT video:** Every source id on a **powered** screen must keep its `<video>` playing. Pausing is only for sources not shown on any powered CRT.

- `visibleSourceIdsFromScreens` → `syncPlaybackForSourceIds`.
- `AudioRouter.routeTo` may mute all videos and unmute the **main program** source. It must **not** pause preview videos.
- Do **not** reintroduce per-frame canvas blit downscaling for user video (caused stutter with four loaded clips). Use `VideoTexture`. Soft-trim via `playEndSec` only.

**Invariant — audio:** Main source with `hasAudio` → program audio + ducked hum. Else → TV hum. Previews stay muted.
**Invariant — main switch:** Changing main (knob, promote, dropdown, upload) must `ensure` then `syncToSource` so the new clip’s audio replaces the previous — never leave the old unmuted element as program.
**Invariant — interruption:** After tab hide / AudioContext suspend, resume context, re-play keep-playing videos, and `refreshRoute` / `routeTo` so hum + program audio do not stay dead.

**Invariant — uploads:** User video/image register in memory + IndexedDB; survive reload; appear in channel bank and source dropdowns; drag-drop onto a CRT assigns that screen.

## Camera

- Front/reset framing steps back on narrow canvas aspects to contain the cabinet width, retaining the desktop pose when it fits. Orbit max distance and home return use that same responsive pose. Canvas resizes reframe front/reset and main CRT independently of preset transitions, including with reduced motion.
- Main CRT **left-click tap** toggles `mainCrt` preset (a press that then slides is an orbit; right-click is pan — neither zooms). Distance is **contain-fitted** from canvas aspect + camera FOV so the outer bezel lines up with the viewport (no fixed-z over-zoom on wide/tall resolutions). Esc / click again returns to `front`. Zoom enter/leave batches preset + focus in one store update (`setMainCrtZoom`) so the camera tween does not restart. Soft-focus and DoF bokeh **ease** with the preset duration (never remount DepthOfField / rebuild EffectComposer). While zoomed, the camera is **level-locked** (`up = +Y`, orbit rotate off) so the bezel stays square to the browser. Zoom-out skips `OrbitControls.update()` until the ease completes (stale spherical was causing a pre-tween jump).
- Free orbit from **front** is clamped to about **±60°** yaw/pitch around the starting pose and cannot dolly farther out than that framing. Rotate speed is half of OrbitControls default. After an orbit or pan ends, the camera eases back to the centered front view. Side / rear / top / iso presets lift the cone so inspection still works.
- Animate **camera position and OrbitControls target together**. Never snap `target` prop while position eases (causes jump-then-zoom). Do not put canvas `size` in the same effect as the preset tween.

## Controls

- The nonmodal Field guide opens on the first visit and remains available from Guide. Starting or dismissing it is remembered in local storage; unavailable storage must not prevent use. Guide and Controls are mutually exclusive. Its demonstrations use the existing power, routing, audio-unlock, and camera actions, respect assignment locks and screen power, and never reset the user's setup. Steps support keyboard navigation and restore focus on dismissal; embedded Escape remains host-owned. Portrait uses a bottom sheet and short landscape a side drawer, leaving room for the TV.
- Phones/tablets have a persistent power / main-screen view / controls dock with 44px touch targets and safe-area spacing. Portrait controls use a scrolling bottom sheet; short landscape screens use a side drawer. The scene resizes into the available space. Closed controls are hidden from focus and assistive technology. DOM controls retain native keyboard behavior; Tab traversal, modifier shortcuts, and host-owned events are never intercepted.
- Pointer/grab cursors on interactive meshes; knobs/sliders use grab/grabbing.
- Main knob: angular drag with accumulated angle + pointer capture for the full press.
- Lock switch: bright red + emissive when engaged.
- The guide keeps each task short, with extra instructions under Tips. Its tuning stop explicitly frames the main CRT; leaving that stop returns to the whole set. On mobile, the compact guide card replaces the quick dock, reserving more space for the TV. Tips reset to closed between stops.
- Starter channels are plasma (`weather`) on main, then moiré (`newsroom`), stars (`starfield`), and cells (`automata`). Initial/reset `channelBank` must point to the main source. Picture defaults are brightness 0.85, contrast 1.2, saturation 1, tuning 0.92, preview level 0.9; opening the guide must not overwrite picture adjustments.

## Performance / quality

- Prefer GPU `VideoTexture` over CPU canvas copies for video.
- Procedural sources are fine on all four screens; user 4K may still be heavy to **decode**, but never add N× canvas drawImage loops.
- Graphics tier = `detectDeviceQuality()` → `qualityCeiling`; runtime `quality` may auto-drop/recover via `AdaptiveQuality` but never above the ceiling (except XR session).
- CRT look scales with `QUALITY_CONFIGS[quality].crt` (one shader program, tier uniforms). Low/XR skip post FX and shadows; high/ultra get bloom/DoF/grain + richer CRT mask. Soft-focus is mild on high/ultra and runs on the **main** CRT only (previews force `softFocusQuality = 0`). On `mainCrt` zoom, soft-focus and DoF bokeh ease toward sharp reading without remounting the composer. Picture fills a hollow-bezel aperture (no shader oval crop; mild overscan). CRT glass is a **slightly bulged**, **rounded** subdivided plane matched to the bezel hole (baked dome + mild UV barrel) so corners stay continuous with the lip.
- Fake 3D on main CRT only: default `parallax`; Controls can pick `anaglyph` / `crtDepth` / `off`. Previews stay flat (`depthMode = 0`).

**Invariant — frame budget:** the `useFrame` loop must stay allocation-free and must not do work for content nobody can see.

- `SourceManager.update(time, visibleIds)` only advances `heavyUpdate` sources (canvas channels, render targets) that sit on a powered CRT. Mark any new canvas-backed source `heavyUpdate: true`.
- The product-orbit render target only renders when `productOrbit` is on a powered screen.
- Reuse buffers in animated procedural clips (`ImageData`, typed arrays) — never allocate per frame.
- Use `writeSignalUniforms` (scratch object), cached indicator meshes, and the cached `getChannelBankIds()`; do not re-traverse the model graph or rebuild the channel bank per frame.

## Tests to keep green

- `tests/playbackPolicy.test.ts` — visible ids, pause policy, program audio, channel bank order.
- `tests/qualityConfig.test.ts` — tier ladder, ceiling clamp, render scale, device probe tiers.
- `tests/sourceUpdatePolicy.test.ts` — off-screen canvas channels are skipped, cheap updates are not.
- `tests/screenRouter.test.ts`, `tests/tvStore.test.ts`, `tests/interaction.test.ts`.
- `tests/mainCrtFraming.test.ts` — main CRT zoom contain-fits bezel to canvas aspect.
- `tests/orbitLimits.test.ts` — front orbit ±60° cone; starting distance is max zoom-out.

If you change an invariant, update this file and the matching test in the same change.

## Embedded host lifecycle

The optional `packages/msfn-runtime` adapter mounts this same application in MSFN. It caps DPR to the supplied host budget, uses a container rather than viewport dimensions, and reserves Escape for the host. Standalone `npm run dev` is unchanged.

On eject, audio lifecycle listeners detach, media stops, transient GPU resources and blob URLs are released, and UI/TV stores reset. IndexedDB uploads are retained. Device probing runs when Experience mounts rather than when its module is preloaded; the temporary probe context is released. XR developer emulation is disabled during module loading.
