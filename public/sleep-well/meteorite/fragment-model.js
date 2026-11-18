import { specimenFragmentShader, specimenVertexShader, stoneInks } from './printed-material.js';

// All carousel clones share the same illustrated stone inks as the main specimen.
export function makeFragmentCarouselModel({ Group, Box3, Vector3, ShaderMaterial, Color }, specimen) {
  const group = new Group();
  const bounds = new Box3().setFromObject(specimen);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const scale = 1.08 / Math.max(size.x, size.y, size.z);
  const inkNames = ['shadowInk', 'middleInk', 'paintInk', 'lightInk', 'outlineInk'];
  const inks = Object.fromEntries(inkNames.map((name, index) => [
    name, { value: new Color(stoneInks[index]) },
  ]));
  const printMaterials = new Map();

  specimen.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material.map) return;
    const { map } = mesh.material;
    if (!printMaterials.has(map)) {
      printMaterials.set(map, new ShaderMaterial({
        defines: { PRINT_INK: 1 },
        uniforms: { ...inks, surface: { value: map } },
        vertexShader: specimenVertexShader,
        fragmentShader: specimenFragmentShader,
      }));
    }
    mesh.material = printMaterials.get(map);
  });
  specimen.scale.multiplyScalar(scale);
  specimen.position.addScaledVector(center, -scale);
  group.add(specimen);
  return group;
}

export function poseFragment(fragment, index) {
  // Repeat the silhouettes at the same interval as the carousel's loop.
  const phase = index % 16;
  fragment.rotation.set(
    .36 * Math.sin(phase * 1.87),
    -.38 + .71 * Math.sin(phase * 2.31),
    .24 + .47 * Math.sin(phase * 1.43),
  );
  fragment.scale.setScalar(1 + .07 * Math.sin(phase * 2.49));
}
