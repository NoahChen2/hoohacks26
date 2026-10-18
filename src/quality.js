// Rendering tier chosen once at startup. Phones and tablets get fewer pixels, no
// MSAA (the ink outlines already hide stair-stepping), cheaper shadows and a
// coarser body mesh; the weakest devices also animate at 30 fps.
// `?quality=low|mobile|high` overrides detection.
// The body first appears as a quick draft mesh (draftResolution, ~0.3 s to
// build) and is refined to bodyResolution in the background.
const TIERS = {
  high: { name: 'high', pixelRatio: 2, antialias: true, shadowSize: 2048, softShadows: true, bodyResolution: 112, draftResolution: 64, fps: 60 },
  mobile: { name: 'mobile', pixelRatio: 1.5, antialias: false, shadowSize: 1024, softShadows: false, bodyResolution: 96, draftResolution: 64, fps: 60 },
  low: { name: 'low', pixelRatio: 1, antialias: false, shadowSize: 512, softShadows: false, bodyResolution: 80, draftResolution: 56, fps: 30 },
};

// Small embedded viewers (body cards on other pages): the draft mesh only,
// fewer pixels, cheap shadows and 30 fps.
export function cardQuality(base = detectQuality()) {
  const draft = base.draftResolution;
  return { ...base, name: 'card', pixelRatio: Math.min(base.pixelRatio, 1.5), shadowSize: Math.min(base.shadowSize, 1024), softShadows: false, bodyResolution: draft, draftResolution: draft, fps: 30 };
}

export function detectQuality() {
  const forced = new URLSearchParams(location.search).get('quality');
  if (TIERS[forced]) return TIERS[forced];
  const cores = navigator.hardwareConcurrency || 4, memory = navigator.deviceMemory || 4;
  const touch = matchMedia('(pointer: coarse)').matches;
  if (memory <= 2 || (touch && (memory <= 3 || cores <= 4))) return TIERS.low;
  return touch ? TIERS.mobile : TIERS.high;
}
