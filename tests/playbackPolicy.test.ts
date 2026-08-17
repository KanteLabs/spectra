import { describe, expect, it } from "vitest";
import {
  buildChannelBankIds,
  channelIndexForSource,
  shouldPauseManagedVideo,
  shouldUseProgramAudio,
  videoIdsToKeepPlaying,
  visibleSourceIdsFromScreens,
} from "@/systems/media/playbackPolicy";
import type { ScreenId, ScreenSlot } from "@/types";

function slot(
  sourceId: string,
  powered = true
): Pick<ScreenSlot, "powered" | "sourceId"> {
  return { sourceId, powered };
}

describe("visibleSourceIdsFromScreens", () => {
  it("includes every powered CRT source", () => {
    const screens = {
      main: slot("user:a"),
      preview1: slot("user:b"),
      preview2: slot("smpte"),
      preview3: slot("variety", false),
    } as Record<ScreenId, Pick<ScreenSlot, "powered" | "sourceId">>;

    expect(visibleSourceIdsFromScreens(screens).sort()).toEqual(
      ["smpte", "user:a", "user:b"].sort()
    );
  });
});

describe("multi-CRT playback policy", () => {
  it("keeps preview uploads playing when main is a different source", () => {
    const visible = ["newsroom", "user:previewClip", "user:other", "smpte"];
    const keep = videoIdsToKeepPlaying(visible);

    expect(shouldPauseManagedVideo("user:previewClip", keep)).toBe(false);
    expect(shouldPauseManagedVideo("user:other", keep)).toBe(false);
    expect(shouldPauseManagedVideo("newsroom", keep)).toBe(false);
  });

  it("pauses only sources not shown on any powered CRT", () => {
    const keep = videoIdsToKeepPlaying(["user:onMain", "smpte"]);
    expect(shouldPauseManagedVideo("user:orphaned", keep)).toBe(true);
    expect(shouldPauseManagedVideo("user:onMain", keep)).toBe(false);
  });

  it("must not treat program-audio id as the sole keep-playing set", () => {
    // Regression: routeTo(mainId) used to pause everything except main.
    const programId = "user:mainAudio";
    const visible = [programId, "user:onP1", "user:onP2"];
    const keep = videoIdsToKeepPlaying(visible);
    expect(shouldPauseManagedVideo("user:onP1", keep)).toBe(false);
    expect(keep.has(programId)).toBe(true);
    expect(keep.size).toBe(3);
  });
});

describe("program audio policy", () => {
  it("uses file audio only when the main source is a video with audio", () => {
    expect(
      shouldUseProgramAudio({ hasVideoElement: true, hasAudio: true })
    ).toBe(true);
    expect(
      shouldUseProgramAudio({ hasVideoElement: true, hasAudio: false })
    ).toBe(false);
    expect(
      shouldUseProgramAudio({ hasVideoElement: false, hasAudio: true })
    ).toBe(false);
  });
});

describe("channel bank", () => {
  it("appends user uploads after built-in catalog ids", () => {
    const bank = buildChannelBankIds(
      ["variety", "smpte", "newsroom"],
      ["user:clip1", "user:still1"]
    );
    expect(bank).toEqual([
      "variety",
      "smpte",
      "newsroom",
      "user:clip1",
      "user:still1",
    ]);
    expect(channelIndexForSource(bank, "user:clip1")).toBe(3);
  });

  it("returns -1 for sources not in the bank", () => {
    expect(channelIndexForSource(["a", "b"], "missing")).toBe(-1);
  });
});
