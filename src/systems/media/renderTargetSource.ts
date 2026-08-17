import * as THREE from "three";
import type { ManagedSource } from "./SourceManager";

/**
 * Mini Three.js scene rendered into a shared WebGLRenderTarget
 * for the product-orbit preview channel.
 */
export function createProductOrbitSource(
  renderer: THREE.WebGLRenderer,
  size = 512
): ManagedSource & { render: () => void; setSize: (n: number) => void } {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2a2218");

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0.4, 2.2);
  camera.lookAt(0, 0, 0);

  const light = new THREE.DirectionalLight(0xffe6c8, 1.4);
  light.position.set(2, 3, 2);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x886655, 0.45));

  const product = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.35),
    new THREE.MeshStandardMaterial({
      color: "#c9c3b8",
      roughness: 0.45,
      metalness: 0.1,
    })
  );
  scene.add(product);

  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16),
    new THREE.MeshStandardMaterial({ color: "#c4121a", roughness: 0.3 })
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.2, 0, 0.18);
  product.add(knob);

  let t = 0;

  return {
    id: "productOrbit",
    texture: rt.texture,
    loadState: "ready",
    hasAudio: false,
    heavyUpdate: true,
    update: (time: number) => {
      t = time;
      product.rotation.y = time * 0.4;
    },
    render: () => {
      product.rotation.y = t * 0.4;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prev);
    },
    setSize: (n: number) => {
      if (rt.width === n) return;
      rt.setSize(n, n);
    },
    dispose: () => {
      rt.dispose();
      product.geometry.dispose();
      (product.material as THREE.Material).dispose();
    },
  };
}
