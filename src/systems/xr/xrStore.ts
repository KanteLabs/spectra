import { createXRStore } from "@react-three/xr";

export const xrStore = createXRStore({
  hand: true,
  controller: true,
});
