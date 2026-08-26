# Spectra architecture

Read this when changing media routing, audio, camera, or quality — not for every channel pixel tweak.

## Media pipeline

```
SOURCE_CATALOG / userSources
        ↓
SourceManager.ensure(id)
  procedural → createProceduralById → CanvasTexture (+ optional update)
  video      → <video> + VideoTexture
  image      → TextureLoader
  renderTarget → productOrbit (shared GL render)
        ↓
tvStore screens[screenId].sourceId
        ↓
SpectraTV materials sample textures
        ↓
each frame: visibleSourceIdsFromScreens → SourceManager.update(t, visibleIds)
```

### SourceManager

- `heavyUpdate: true` when clip has `update` — skipped if source not on a powered CRT
- Videos: keep playing iff id ∈ `videoIdsToKeepPlaying(visibleIds)`
- Fallback on failure: SMPTE procedural

### Channel bank

- `getChannelBankIds()` = catalog ids + user upload ids (cached; invalidate on user-source change)
- Assigning **main** must set `channelBank` to that source’s index so the knob can reach uploads again

### Uploads

- Ingest → blob URL + IndexedDB
- Appear in Controls dropdown and dial bank
- Drag-drop onto a CRT assigns that screen
- Prefer `VideoTexture`; never per-frame canvas downscale of user video

## Audio

```
AudioRouter.routeTo(mainSourceId, volume)
  muteAllVideos()          // mute only — do NOT pause
  if video && hasAudio → unmute program + duck hum
  else → idle hum
```

- Previews always muted
- Main switch: `ensure` then `syncToSource` (async-safe)
- Tab return / AudioContext suspend: `recoverAfterInterruption` + `resumeKeepPlaying` + `refreshRoute`
- Procedural channels use the idle hum; program audio comes from video sources.

Policy helpers: `src/systems/media/playbackPolicy.ts` (pure, unit-tested).

## Camera / orbit

| Concern | Location |
|---------|----------|
| Front pose | `FRONT_VIEW` in `orbitLimits.ts` |
| Front free look | `frontOrbitLimits()` — ±60° cone, maxDistance = start radius |
| Inspect presets | `INSPECT_ORBIT_LIMITS` |
| Tween pose | `CameraRig` — position + target together via gsap |
| Home return | After orbit/pan end on front/reset |
| Main CRT zoom | Contain-fit bezel; left-click **tap** only (`isClickNotDrag`); level-lock while zoomed |

## Quality

- Boot: `detectDeviceQuality()` → `qualityCeiling`
- Runtime: adaptive drop/recover via `TIER_ABOVE` / `TIER_BELOW` — never above ceiling
- `ultra` needs recognised desktop-class GPU (supersample via `renderScaleFor`)
- Low/XR: no post stack; CRT soft-focus taps = 0 on previews always

## Tests agents must keep green

| File | Covers |
|------|--------|
| `playbackPolicy.test.ts` | Visible ids, pause policy, program audio, bank order |
| `sourceUpdatePolicy.test.ts` | Off-screen heavy updates skipped |
| `orbitLimits.test.ts` | Front cone / max distance |
| `qualityConfig.test.ts` | Tier ladder / ceiling |
| `interaction.test.ts` | Click-vs-drag, pointer math |
| `mainCrtFraming.test.ts` | Zoom contain-fit |

Intentional contract change → update `docs/specs/BEHAVIORS.md` + tests together.
