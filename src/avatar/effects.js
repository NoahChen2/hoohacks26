/** @typedef {{primary:string,secondary:string,silhouette:'torso'|'orb'|'lotus'|'tall'|'void'|'celestial',glow:number,particleType:'spark'|'petal'|'thread'|'square',particleCount:number,speed:number,ribbonCount:number,groundRing:'none'|'stitched'|'celestial'}} AuraEffect */
/** @type {Record<string,AuraEffect>} */
export const EFFECTS={
 'quiet-chi':{primary:'#8fc8a5',secondary:'#e1e9c4',silhouette:'torso',glow:.3,particleType:'spark',particleCount:5,speed:12,ribbonCount:0,groundRing:'none'},
 'foundation-thread':{primary:'#63d2b1',secondary:'#d2f4d7',silhouette:'torso',glow:.35,particleType:'thread',particleCount:8,speed:14,ribbonCount:2,groundRing:'stitched'},
 'golden-core':{primary:'#e9bd64',secondary:'#fff0c5',silhouette:'orb',glow:.45,particleType:'spark',particleCount:7,speed:15,ribbonCount:0,groundRing:'none'},
 'lotus-soul':{primary:'#a6dbc4',secondary:'#efb9ce',silhouette:'lotus',glow:.35,particleType:'petal',particleCount:10,speed:16,ribbonCount:0,groundRing:'stitched'},
 'soul-transformation':{primary:'#f1cf82',secondary:'#fff9e8',silhouette:'tall',glow:.5,particleType:'thread',particleCount:14,speed:14,ribbonCount:3,groundRing:'stitched'},
 'void-refinement':{primary:'#9c83e5',secondary:'#2e254b',silhouette:'void',glow:.4,particleType:'square',particleCount:12,speed:18,ribbonCount:1,groundRing:'celestial'},
 'immortal-weaver':{primary:'#fff4d4',secondary:'#e7c778',silhouette:'celestial',glow:.5,particleType:'petal',particleCount:18,speed:16,ribbonCount:3,groundRing:'celestial'},
 'theme-aura':{primary:'#b4da8c',secondary:'#f1e7be',silhouette:'torso',glow:.3,particleType:'spark',particleCount:6,speed:14,ribbonCount:1,groundRing:'stitched'},
 'theme-advanced-aura':{primary:'#b4da8c',secondary:'#ffe9ad',silhouette:'celestial',glow:.45,particleType:'petal',particleCount:16,speed:16,ribbonCount:3,groundRing:'celestial'},
};
export const PALETTES={cultivation:{primary:'#79d3bc',secondary:'#f0d28b',robe:'#527d75',ink:'#153a3f',skin:'#e5bd9f'},garden:{primary:'#c4e399',secondary:'#f2bdd2',robe:'#6e986a',ink:'#263d39',skin:'#e5bd9f'},fantasy:{primary:'#c5a3f2',secondary:'#f4d791',robe:'#78609d',ink:'#2e2540',skin:'#e5bd9f'},runway:{primary:'#f2c3b4',secondary:'#fff0cf',robe:'#a46d7c',ink:'#442b38',skin:'#e5bd9f'},cyber:{primary:'#76dff4',secondary:'#b4a5fa',robe:'#367d99',ink:'#172c3c',skin:'#e5bd9f'}};
/** @param {string|undefined} id @param {keyof typeof PALETTES} theme @returns {AuraEffect|null} */
export function effectFor(id,theme) {
 if(!id)return null;
 const base=EFFECTS[id];if(!base)return null;
 if(theme==='cultivation')return base;
 const colors=PALETTES[theme]||PALETTES.cultivation;
 return {...base,primary:colors.primary,secondary:colors.secondary,particleType:theme==='cyber'?'square':theme==='garden'?'petal':base.particleType,silhouette:theme==='garden'&&id==='theme-advanced-aura'?'lotus':base.silhouette};
}
