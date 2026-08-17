"use client";

import { useEffect } from "react";
import { useTvStore } from "@/state/tvStore";
import { useUiStore } from "@/state/uiStore";
import {
  cycleControlId,
  parseKeyAction,
} from "@/systems/interaction/keyboard";
import { getControlById } from "@/model/controlRegistry";
import { getAudioRouter } from "@/systems/media/AudioRouter";
import { getChannelBankIds } from "@/systems/media/sourceCatalog";

export function KeyboardBridge() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = parseKeyAction(e);
      if (!action) return;
      e.preventDefault();

      const tv = useTvStore.getState();
      const ui = useUiStore.getState();
      tv.unlockAudio();
      getAudioRouter().unlock();

      switch (action.type) {
        case "focusNext":
          ui.setFocusControlId(cycleControlId(ui.focusControlId, 1));
          tv.setSelectedControl(ui.focusControlId);
          break;
        case "focusPrev":
          ui.setFocusControlId(cycleControlId(ui.focusControlId, -1));
          break;
        case "activate": {
          const id = ui.focusControlId ?? tv.selectedControlId;
          if (!id) break;
          const spec = getControlById(id);
          if (!spec) break;
          if (id === "power" || id === "mainKnob") {
            if (tv.power === "off" || tv.power === "shuttingDown") {
              tv.togglePower();
            } else if (id === "power") {
              tv.togglePower();
            }
          }
          if (id === "previewBtn1") tv.promote("preview1");
          if (id === "previewBtn2") tv.promote("preview2");
          if (id === "previewBtn3") tv.promote("preview3");
          if (id === "switchLock") tv.setLock(!tv.locked);
          if (id === "switchPreviews") {
            const anyOn =
              tv.screens.preview1.powered ||
              tv.screens.preview2.powered ||
              tv.screens.preview3.powered;
            tv.setPreviewsPowered(!anyOn);
          }
          if (id === "secondaryKnob1") tv.cyclePreviewSource("preview1");
          if (id === "secondaryKnob2") tv.cyclePreviewSource("preview2");
          if (id === "secondaryKnob3") tv.cyclePreviewSource("preview3");
          if (id === "screenP1") tv.promote("preview1");
          if (id === "screenP2") tv.promote("preview2");
          if (id === "screenP3") tv.promote("preview3");
          if (id === "screenMain") {
            ui.setMainCrtZoom(ui.cameraPreset !== "mainCrt");
          }
          break;
        }
        case "adjust": {
          const id = ui.focusControlId;
          if (!id) break;
          const step = action.delta * 0.05;
          if (id === "sliderBrightness")
            tv.setPicture({
              brightness: Math.min(1, Math.max(0.2, tv.picture.brightness + step)),
            });
          if (id === "sliderContrast")
            tv.setPicture({
              contrast: Math.min(1.2, Math.max(0.2, tv.picture.contrast + step)),
            });
          if (id === "sliderSaturation")
            tv.setPicture({
              saturation: Math.min(1, Math.max(0, tv.picture.saturation + step)),
            });
          if (id === "sliderTuning")
            tv.setPicture({
              tuning: Math.min(1, Math.max(0, tv.picture.tuning + step)),
            });
          if (id === "sliderVolume")
            tv.setPicture({
              volume: Math.min(1, Math.max(0, tv.picture.volume + step)),
            });
          if (id === "sliderPreview")
            tv.setPicture({
              previewLevel: Math.min(
                1,
                Math.max(0, tv.picture.previewLevel + step)
              ),
            });
          if (id === "mainKnob") {
            const bank = getChannelBankIds();
            const max = Math.max(0, bank.length - 1);
            const next = Math.min(max, Math.max(0, tv.channelBank + action.delta));
            tv.setChannelBank(next);
            if (bank[next]) tv.assignSource("main", bank[next]);
          }
          break;
        }
        case "escape":
          useUiStore.setState({
            focusControlId: null,
            cameraPreset: "front",
            cinemaScreenId: null,
            panelOpen: false,
          });
          break;
        case "cameraPreset":
          ui.setCameraPreset(action.preset as "front");
          break;
        case "resetCamera":
          useUiStore.setState({
            cameraPreset: "reset",
            focusControlId: null,
          });
          break;
        case "togglePower":
          tv.togglePower();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
