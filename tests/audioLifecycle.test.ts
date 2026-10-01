import { afterEach, expect, it, vi } from "vitest";
import { AudioRouter } from "../src/systems/media/AudioRouter";
vi.mock("../src/systems/media/SourceManager", () => ({ getSourceManager: () => ({resumeKeepPlaying:vi.fn()}) }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("removes lifecycle listeners on every eject and safely permits another mount", async () => {
 const win = new EventTarget();
 const doc = Object.assign(new EventTarget(), {visibilityState:"visible"});
 class Context extends EventTarget {
  state = "running";
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {this.state="closed";});
 }
 vi.stubGlobal("window",win); vi.stubGlobal("document",doc); vi.stubGlobal("AudioContext",Context);
 const router = new AudioRouter();
 const recovery = vi.spyOn(router,"recoverAfterInterruption").mockResolvedValue();
 for(let i=0;i<3;i++) {
   await router.unlock();
   win.dispatchEvent(new Event("focus"));
   expect(recovery).toHaveBeenCalledTimes(i+1);
   router.dispose();
   win.dispatchEvent(new Event("focus"));
   doc.dispatchEvent(new Event("visibilitychange"));
   expect(recovery).toHaveBeenCalledTimes(i+1);
 }
});
