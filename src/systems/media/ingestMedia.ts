import type { ScreenId } from "@/types";
import { useTvStore } from "@/state/tvStore";
import { getSourceManager } from "./SourceManager";
import { getAudioRouter } from "./AudioRouter";
import { registerUserMediaFile } from "./userSources";

export function isMediaFile(file: File): boolean {
  return file.type.startsWith("video/") || file.type.startsWith("image/");
}

/**
 * Process + persist a user file, then assign it to a screen.
 */
export async function ingestAndAssignMedia(
  file: File,
  screenId: ScreenId = "main"
): Promise<string> {
  if (!isMediaFile(file)) {
    throw new Error("Please drop a video or image file");
  }

  const tv = useTvStore.getState();
  tv.unlockAudio();
  void getAudioRouter().unlock();

  const def = await registerUserMediaFile(file);
  await getSourceManager().ensure(def.id);
  const ok = tv.assignSource(screenId, def.id);
  if (!ok) {
    throw new Error("Could not assign media (assignments may be locked)");
  }

  if (screenId === "main" && tv.power === "on") {
    getAudioRouter().routeTo(def.id, tv.picture.volume);
  }

  return def.id;
}
