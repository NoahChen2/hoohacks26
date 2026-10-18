import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Object3D, SkinnedMesh, Mesh, Material, Texture } from 'three';
import type { CharacterAssetManifest, Measurements, VisualProportions, BodyPreset } from './types.ts';

type MorphKey = keyof Measurements | keyof VisualProportions | BodyPreset;
export function inspectCharacterAsset(root: Object3D) {
  const morphs = new Set<string>(), bones = new Set<string>();
  let skinnedMeshes = 0;
  root.traverse(object => {
    const mesh = object as SkinnedMesh;
    if (mesh.isSkinnedMesh) { skinnedMeshes++; mesh.skeleton.bones.forEach(bone => bones.add(bone.name)); }
    Object.keys((object as Mesh).morphTargetDictionary || {}).forEach(name => morphs.add(name));
  });
  return { skinnedMeshes, bones: [...bones], morphs: [...morphs] };
}

export function applyCharacterMorphs(root: Object3D, manifest: CharacterAssetManifest, values: Partial<Record<MorphKey, number>>) {
  const available = new Set(inspectCharacterAsset(root).morphs), unsupported: string[] = [], outOfRange: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const binding = manifest.morphs[key as MorphKey];
    if (!binding || !available.has(binding.name)) { unsupported.push(key); continue; }
    if (!Number.isFinite(value) || value < binding.min || value > binding.max || binding.max <= binding.min) { outOfRange.push(key); continue; }
    root.traverse(object => {
      const mesh = object as Mesh, index = mesh.morphTargetDictionary?.[binding.name];
      if (index !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = (value - binding.min) / (binding.max - binding.min);
    });
  }
  return { unsupported, outOfRange };
}

export function disposeCharacterAsset(root: Object3D) {
  const geometries = new Set<Mesh['geometry']>(), materials = new Set<Material>(), textures = new Set<Texture>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    list.forEach(material => { materials.add(material); Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); }); });
    if ((object as SkinnedMesh).isSkinnedMesh) (object as SkinnedMesh).skeleton.dispose();
  });
  textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
}

export async function loadCharacterAsset(manifest: CharacterAssetManifest, measurements: Measurements) {
  if (!manifest.license.trim() || !manifest.attribution.trim()) throw new Error('Character assets require license and attribution metadata.');
  const gltf = await new GLTFLoader().loadAsync(manifest.url);
  const root = gltf.scene, inventory = inspectCharacterAsset(root);
  try {
    if (!inventory.skinnedMeshes) throw new Error('The character asset must contain a skinned mesh and skeleton.');
    const result = applyCharacterMorphs(root, manifest, measurements);
    if (result.unsupported.length || result.outOfRange.length) throw new Error(`Uncalibrated body measurements: ${[...result.unsupported, ...result.outOfRange].join(', ')}`);
    root.scale.multiplyScalar(manifest.units === 'metres' ? 100 : 1);
    return { root, inventory, animations: gltf.animations };
  } catch (error) { disposeCharacterAsset(root); throw error; }
}
