export type BodyPreset = 'feminine' | 'masculine';
export type BodyBuild = 'slim' | 'average' | 'athletic' | 'muscular' | 'curvy' | 'plus';
export interface Measurements {
  height: number; chest: number; waist: number; hips: number; shoulder: number;
  arm: number; inseam: number; neck: number; thigh: number;
}
export interface VisualProportions {
  shoulderBreadth: number;
  torsoLength: number;
  legRatio: number;
  upperArmVolume: number;
  thighVolume: number;
  calfVolume: number;
  muscleDefinition: number;
  fullness: number;
}
export interface CharacterCustomization {
  version: 1;
  bodyPreset: BodyPreset;
  build: BodyBuild;
  sizePreset: string | null;
  proportions: VisualProportions;
}
export type MorphBinding = { name: string; min: number; max: number };
export interface CharacterAssetManifest {
  url: string;
  license: string;
  attribution: string;
  units: 'metres' | 'centimetres';
  // A calibrated, asset-specific map is required; morph names are not universal.
  morphs: Partial<Record<keyof Measurements | keyof VisualProportions | BodyPreset, MorphBinding>>;
}
