"use client";

import { useUiStore } from "@/state/uiStore";
import { xrStore } from "@/systems/xr/xrStore";
import { useTvStore } from "@/state/tvStore";
import { getAudioRouter } from "@/systems/media/AudioRouter";

export function XRButton() {
  const xrSupported = useUiStore((s) => s.xrSupported);
  const unlockAudio = useTvStore((s) => s.unlockAudio);

  if (!xrSupported) return null;

  return (
    <button
      type="button"
      className="xr-button"
      onClick={() => {
        unlockAudio();
        getAudioRouter().unlock();
        void xrStore.enterVR();
      }}
    >
      Enter VR
    </button>
  );
}
