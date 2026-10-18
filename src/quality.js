// Rendering tier chosen once at startup. Phones and tablets get fewer pixels, no
// MSAA (the ink outlines already hide stair-stepping), cheaper shadows and a
// coarser body mesh; the weakest devices also animate at 30 fps.
// `?quality=low|mobile|high` overrides detection.
const TIERS = {
  high: { name: 'high', pixelRatio: 2, antialias: true, shadowSize: 2048, softShadows: true, bodyResolution: 128, fps: 60 },
  mobile: { name: 'mobile', pixelRatio: 1.5, antialias: false, shadowSize: 1024, softShadows: false, bodyResolution: 104, fps: 60 },
  low: { name: 'low', pixelRatio: 1, antialias: false, shadowSize: 512, softShadows: false, bodyResolution: 88, fps: 30 },
};

export function detectQuality() {
  const forced = new URLSearchParams(location.search).get('quality');
  if (TIERS[forced]) return TIERS[forced];
  const cores = navigator.hardwareConcurrency || 4, memory = navigator.deviceMemory || 4;
  const touch = matchMedia('(pointer: coarse)').matches;
  if (memory <= 2 || (touch && (memory <= 3 || cores <= 4))) return TIERS.low;
  return touch ? TIERS.mobile : TIERS.high;
}
