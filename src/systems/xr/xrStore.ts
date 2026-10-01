import { createXRStore } from "@react-three/xr";

export const xrStore = createXRStore({
  emulate: false,
  hand: true,
  controller: true,
});
