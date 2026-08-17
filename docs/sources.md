# Replacing video sources

Behavioral contract for media (multi-CRT playback, uploads, channel bank): see [`specs/BEHAVIORS.md`](./specs/BEHAVIORS.md).

Sources are defined in [`src/systems/media/sourceCatalog.ts`](../src/systems/media/sourceCatalog.ts).

The shipped experience uses **procedural channels** plus optional **user uploads** (video/image via blob + IndexedDB). No remote MP4s are required.

## Add a procedural channel

1. Implement a clip in [`proceduralSources.ts`](../src/systems/media/proceduralSources.ts) and register it in `createProceduralById`.
2. Add a catalog entry:

```ts
{
  id: "myChannel",
  label: "My Channel",
  kind: "procedural",
  hasAudio: false,
  colorAmount: 1,
}
```

## Add a remote video (optional)

```ts
{
  id: "myClip",
  label: "My Clip",
  kind: "video",
  url: "https://example.com/video.mp4",
  hasAudio: true,
  colorAmount: 1,
}
```

Requirements for video:

- CORS headers allowing the app origin
- Prefer MP4 / H.264
- Videos start muted for autoplay policy

## Local file

1. Place the file in `public/media/`.
2. Set `url: "/media/your-file.mp4"`.

## Assign to a screen

Use the Controls panel, the main channel knob, or:

```ts
useTvStore.getState().assignSource("main", "myChannel");
```

## Fallback

If a source fails, `SourceManager` substitutes the SMPTE procedural pattern.
