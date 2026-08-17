import type { ScreenId, ScreenSlot } from "@/types";

/**
 * Pure media / routing policy helpers.
 * Keep these free of DOM / Three so agents and unit tests share one source of truth.
 */

/** Source ids currently shown on powered CRTs (main + previews). */
export function visibleSourceIdsFromScreens(
  screens: Record<ScreenId, Pick<ScreenSlot, "powered" | "sourceId">>
): string[] {
  return (Object.keys(screens) as ScreenId[])
    .filter((id) => screens[id].powered)
    .map((id) => screens[id].sourceId);
}

/**
 * Videos assigned to any powered screen must keep decoding/playing.
 * Audio program selection (main only) must NEVER be used as the pause set —
 * that regression froze uploaded clips on the three preview CRTs.
 */
export function videoIdsToKeepPlaying(visibleSourceIds: string[]): Set<string> {
  return new Set(visibleSourceIds);
}

export function shouldPauseManagedVideo(
  sourceId: string,
  keepPlaying: Set<string>
): boolean {
  return !keepPlaying.has(sourceId);
}

/** Channel dial order: built-in catalog first, then user uploads. */
export function buildChannelBankIds(
  catalogIds: readonly string[],
  userIds: readonly string[]
): string[] {
  return [...catalogIds, ...userIds];
}

export function channelIndexForSource(
  bank: readonly string[],
  sourceId: string
): number {
  return bank.indexOf(sourceId);
}

/**
 * Program audio is main-screen only.
 * If the active main source has audio → unmute it and duck hum.
 * Otherwise → keep videos muted and use TV hum.
 */
export function shouldUseProgramAudio(opts: {
  hasVideoElement: boolean;
  hasAudio: boolean;
}): boolean {
  return opts.hasVideoElement && opts.hasAudio;
}
