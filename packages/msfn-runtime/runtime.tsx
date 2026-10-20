import React, { useEffect } from "react";
import { Experience } from "../../src/components/scene/Experience";
import { ControlPanel } from "../../src/components/ui/ControlPanel";
import { XRButton } from "../../src/components/ui/XRButton";
import { getAudioRouter } from "../../src/systems/media/AudioRouter";
import { getSourceManager } from "../../src/systems/media/SourceManager";
import { useUiStore } from "../../src/state/uiStore";
import { useTvStore } from "../../src/state/tvStore";
import { releaseUserSources } from "../../src/systems/media/userSources";
import { xrStore } from "../../src/systems/xr/xrStore";
type Props = { active:boolean; onExit:()=>void; containerSize:{width:number;height:number} };
const EmbeddedExperience = React.memo(Experience);
function SpectraRuntime({ active, containerSize }: Props) {
 const panelOpen = useUiStore((s) => s.panelOpen);
 useEffect(() => () => {
   getAudioRouter().dispose();
   getSourceManager().dispose();
   releaseUserSources();
   void xrStore.getState().session?.end();
   useUiStore.setState(useUiStore.getInitialState(), true);
   useTvStore.setState(useTvStore.getInitialState(), true);
 }, []);
 return <div className="spectra-runtime" aria-label="Spectra multiview media system"
   style={{width:containerSize.width,height:containerSize.height}}>
   {active && <div className={`app-shell ${panelOpen ? "controls-open" : ""}`}>
     <div className="scene-viewport"><EmbeddedExperience maxDpr={1.75} /></div>
     <div className="hud"><div className="brand-mark" aria-hidden="true">
       <span className="brand">NORDMENDE</span><span className="product">Spectra Color Studio · 1973</span>
     </div><XRButton /></div>
     <ControlPanel />
   </div>}
 </div>;
}
export default { id:"spectra",runtimeApiVersion:1,mode:"full" as const,renderer:"isolated" as const,suspendHostScene:true as const,Component:SpectraRuntime };
