"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTvStore } from "@/state/tvStore";
import { getSourceManager } from "@/systems/media/SourceManager";
import { registerUserMediaFile } from "@/systems/media/userSources";
import { getAudioRouter } from "@/systems/media/AudioRouter";
import { emit } from "@/state/events";
import type { ScreenId } from "@/types";

const SCREEN_CONTROL: Record<string, ScreenId> = {
  screenMain: "main",
  screenP1: "preview1",
  screenP2: "preview2",
  screenP3: "preview3",
};

function resolveScreenId(object: THREE.Object3D): ScreenId | null {
  let obj: THREE.Object3D | null = object;
  while (obj) {
    if (obj.userData?.screenId) return obj.userData.screenId as ScreenId;
    const cid = obj.userData?.controlId as string | undefined;
    if (cid && SCREEN_CONTROL[cid]) return SCREEN_CONTROL[cid];
    obj = obj.parent;
  }
  return null;
}

/**
 * Canvas-level drag/drop: drop a video/image onto a CRT to assign it.
 */
export function MediaDropBridge({
  screenMeshes,
}: {
  screenMeshes: THREE.Object3D[];
}) {
  const { gl, camera } = useThree();
  const [hoverScreen, setHoverScreen] = useState<ScreenId | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const pickScreen = useCallback(
    (clientX: number, clientY: number): ScreenId | null => {
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(screenMeshes, true);
      for (const hit of hits) {
        const sid = resolveScreenId(hit.object);
        if (sid) return sid;
      }
      return null;
    },
    [camera, gl.domElement, ndc, raycaster, screenMeshes]
  );

  useEffect(() => {
    const el = gl.domElement;

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const sid = pickScreen(e.clientX, e.clientY);
      setHoverScreen(sid);
      el.style.outline = sid ? "2px solid #c4121a" : "";
    };

    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget && el.contains(e.relatedTarget as Node)) return;
      setHoverScreen(null);
      el.style.outline = "";
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.style.outline = "";
      const sid = pickScreen(e.clientX, e.clientY) ?? hoverScreen;
      setHoverScreen(null);
      const file = e.dataTransfer?.files?.[0];
      if (!file || !sid) {
        if (file && !sid) {
          emit({
            type: "announce",
            message: "Drop onto a CRT screen to assign",
          });
        }
        return;
      }

      void (async () => {
        try {
          useTvStore.getState().unlockAudio();
          await getAudioRouter().unlock();
          const def = await registerUserMediaFile(file);
          await getSourceManager().ensure(def.id);
          useTvStore.getState().assignSource(sid, def.id);
          emit({
            type: "announce",
            message: `${def.label} → ${sid}`,
          });
        } catch (err) {
          emit({
            type: "announce",
            message: err instanceof Error ? err.message : "Drop failed",
          });
        }
      })();
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
      el.style.outline = "";
    };
  }, [gl, hoverScreen, pickScreen]);

  return null;
}
