# Adding environments

Environments live in [`src/components/scene/SceneEnvironment.tsx`](../src/components/scene/SceneEnvironment.tsx).

## Add a new room

1. Extend `EnvironmentId` in `src/types/index.ts`.
2. Add a React component that places floor / walls / soft lights and keeps the television at the origin focus (`y ≈ 0.78` for the cabinet body).
3. Branch on `useUiStore().environment` in `SceneEnvironment`.
4. Add an `<option>` in `ControlPanel`.

## Guidelines

- Keep the TV as the visual center; do not crowd the first orbit with competing hero objects.
- Prefer warm practical lights for period rooms; cooler neutrals for studio inspection.
- Honor `QUALITY_CONFIGS[quality].environmentDetail` — drop furniture silhouettes on `simple` / `none`.
- Use drei `<Environment preset="…" />` for cheap IBL; avoid huge custom HDR files unless compressed (KTX2).
