# Nordmende Spectra Color Studio (1973)

Interactive Three.js / React Three Fiber recreation of the Nordmende Spectra Color Studio multiview television — one primary color CRT and three preview CRTs — with physical controls, WebXR, inspection mode, and accessible DOM mirrors.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
npm run export:glb
```

## Stack

Next.js 14 · React 18 · TypeScript · Three.js · R3F · Drei · React Three XR · Zustand · GSAP · GLSL CRT shader · Vitest

## Docs

- [Replacing video sources](docs/sources.md)
- [Screen effects](docs/screen-effects.md)
- [Environments](docs/environments.md)
- [Attributions](docs/ATTRIBUTIONS.md)

## Controls (desktop)

| Input | Action |
| --- | --- |
| Left drag | Orbit |
| Right / modifier drag | Pan |
| Wheel | Zoom |
| Click controls | Operate knobs / buttons / sliders |
| Tab / Shift+Tab | Move between accessible controls (arrows / Enter use native control behavior) |
| 1–6 | Camera presets / reset |
| P | Power |
| Esc | Exit focus / cinema |

XR: Enter VR (when supported). Ray + near grab on the same physical controls. Wrist utility menu for exit / environment / quality / reset.

## Phones and tablets

Drag to orbit, pinch to zoom, and tap a CRT to view/promote it. The bottom bar provides power, a main-screen view toggle, and controls. Controls open below the TV in portrait and beside it on short landscape screens. The camera adapts to the available scene width on resize and rotation. Controls respect device safe areas and use larger touch targets.

## Architecture

See `src/state`, `src/systems`, `src/model`, `src/shaders/crt`, `src/components/scene`.
