import type { SourceDefinition } from "@/types";
import {
  getUserSourceDef,
  listUserSources,
  subscribeUserSources,
} from "./userSources";
import { buildChannelBankIds } from "./playbackPolicy";

/** All shipped channels are procedural or shared-renderer scenes — no remote video. */
export const SOURCE_CATALOG: SourceDefinition[] = [
  {
    id: "newsroom",
    label: "Abendschau Newsdesk",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 1,
  },
  {
    id: "weather",
    label: "Wetterkarte",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 1,
  },
  {
    id: "sports",
    label: "Sport Live",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 1,
  },
  {
    id: "variety",
    label: "Musikladen",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 1,
  },
  {
    id: "broadcast",
    label: "Synthetic Broadcast",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 0.85,
  },
  {
    id: "stationId",
    label: "Station ID",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 1,
  },
  {
    id: "smpte",
    label: "SMPTE Test Pattern",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 1,
  },
  {
    id: "archival",
    label: "Archival Still",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 0.45,
  },
  {
    id: "staticSnow",
    label: "Static / Snow",
    kind: "procedural",
    hasAudio: false,
    colorAmount: 0,
  },
  {
    id: "productOrbit",
    label: "Product Orbit Scene",
    kind: "renderTarget",
    hasAudio: false,
    colorAmount: 0.9,
  },
];

export const CHANNEL_BANK_IDS = SOURCE_CATALOG.map((s) => s.id);

const CATALOG_IDS = SOURCE_CATALOG.map((s) => s.id);
let bankCache: string[] | null = null;
subscribeUserSources(() => {
  bankCache = null;
});

export function getSourceDef(id: string): SourceDefinition | undefined {
  return SOURCE_CATALOG.find((s) => s.id === id) ?? getUserSourceDef(id);
}

/** Built-in + user uploads for dropdowns. */
export function listAssignableSources(): SourceDefinition[] {
  return [...SOURCE_CATALOG, ...listUserSources()];
}

/**
 * Channel knob bank: built-in catalog first, then any uploaded videos.
 * Cached and invalidated whenever user sources change, so uploads stay
 * reachable without rebuilding three arrays on every frame / knob sample.
 */
export function getChannelBankIds(): string[] {
  if (!bankCache) {
    bankCache = buildChannelBankIds(
      CATALOG_IDS,
      listUserSources().map((s) => s.id)
    );
  }
  return bankCache;
}
