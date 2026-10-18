/** @typedef {'main'|'orbit'|'robe'|'hair'|'aura'|'formation'|'background'|'title'|'frame'} EquipmentSlot */
/** @typedef {{id:string,name:string,description:string,slot:EquipmentSlot,themeId:string,rarity:'Common'|'Uncommon'|'Rare'|'Epic'|'Legendary'|'Mythic',requiredTier:number,currencyCost:number,acquisitionMethod:'starter'|'shop'|'milestone',visualEffectId:string,previewAsset:string,accessibleDescription:string}} Item */
export const SLOTS = {main:'Main artifact',orbit:'Orbiting artifact',robe:'Robe / outfit',hair:'Hair ornament',aura:'Aura',formation:'Formation',background:'Background',title:'Title',frame:'Profile frame'};
export const THEME_IDS = ['cultivation','garden','fantasy','runway','cyber'];
/** @type {Item[]} */
export const ITEMS=[];
function add(id,name,slot,tier,cost,asset,effect='none',method='shop',theme='cultivation',description='',rarity) {
 const tiers=['Common','Uncommon','Rare','Epic','Epic','Legendary','Legendary','Mythic'];
 const item={id,name,description:description||`An original ${name.toLowerCase()} cosmetic. Changes appearance only.`,slot,themeId:theme,rarity:rarity||tiers[tier],requiredTier:tier,currencyCost:cost,acquisitionMethod:method,visualEffectId:effect,previewAsset:asset,accessibleDescription:description||`${name}, illustrated ${SLOTS[slot].toLowerCase()} for the ${theme} world.`};
 ITEMS.push(item);return item;
}
add('beginners-needle','Beginner’s Needle','main',0,0,'needle','needle-glint','starter','cultivation','Polished steel needle with a sage thread loop; a small light glint passes along its tip.');
add('jade-shuttle','Jade Thread Shuttle','main',1,40,'shuttle','jade-trail','shop','cultivation','Carved jade shuttle with gold fittings and one curved spiritual-thread trail.');
add('seven-needle-array','Seven-Stitch Needle Array','orbit',2,100,'needle-array','needle-orbit','shop','cultivation','Seven silver needles in a slow elliptical orbit. Low effects shows three stationary needles; static mode illustrates all seven.');
add('mooncutter-shears','Mooncutter Shears','main',3,160,'shears','crescent-shimmer','shop','cultivation','Crescent-shaped tailoring shears with silver edge light and a gentle crescent shimmer.');
add('golden-spindle','Golden Silk Spindle','main',4,220,'spindle','silk-ribbons','shop','cultivation','A floating spindle wrapped in gold thread, with two looping ribbons and restrained sparks.');
add('celestial-loom','Celestial Loom Halo','formation',5,300,'formation','loom-rings','shop','cultivation','Concentric embroidery hoops with original stitch markings, slowly counter-rotating.');
add('voidweaver-needle','Voidweaver Needle','main',6,400,'void-needle','void-afterimage','shop','cultivation','A split violet needle with short translucent afterimages and violet thread fragments.');
add('thousand-thread-crown','Immortal’s Thousand-Thread Crown','hair',7,500,'crown','crown-strands','shop','cultivation','Interwoven antique-gold thread arcs; four luminous strands rise above the crown.');

export const MILESTONE_NAMES = {
 cultivation:['Plain Weaver Robe','Sage Sash','Foundation Thread Aura','Golden Core Formation','Nascent Lotus Backdrop','Soulweaver Mantle','Void Refinement Aura','Immortal Pavilion Background'],
 garden:['Dewpetal Cape','Fernleaf Sash','Firefly Thread Aura','Blossom Circle','Moonlit Lily Garden','Sunpetal Mantle','Nightbloom Aura','Evergreen Sanctuary'],
 fantasy:['Wayfarer Cloak','Copper Guild Sash','Wispweaver Aura','Artisan Rune Circle','Crystal Citadel','Starlit Enchanter Cloak','Astral Forge Aura','Eternal Guildhall'],
 runway:['First Edition Outfit','Satin Atelier Sash','Softbox Halo','Golden Runway Stage','Ivory Atelier','Signature Couture Mantle','Midnight Metallic Aura','Timeless Exhibition'],
 cyber:['Threadline Jacket','Signal Sash','Neon Filament Aura','Core Circuit Ring','Skyline Terminal','Holograph Mantle','Deep Signal Aura','Infinite Network Pavilion'],
};
const milestoneSlots=['robe','robe','aura','formation','background','robe','aura','background'];
const milestoneAssets=['robe','sash','aura','formation','lotus-scene','mantle','aura','pavilion'];
const milestoneEffects=['none','none','foundation-thread','golden-formation','none','mantle-flow','void-refinement','none'];
export const MILESTONES=MILESTONE_NAMES.cultivation.map((_,tier)=>({id:`rank-milestone:${tier}`,tier,itemIds:THEME_IDS.map(theme=>`${theme}-milestone-${tier}`)}));
for(const theme of THEME_IDS) {
 for(let tier=0;tier<8;tier++) add(`${theme}-milestone-${tier}`,MILESTONE_NAMES[theme][tier],milestoneSlots[tier],tier,0,tier===4&&['fantasy','runway','cyber'].includes(theme)?'pavilion':milestoneAssets[tier],theme==='cultivation'?milestoneEffects[tier]:tier===2?'theme-aura':tier===6?'theme-advanced-aura':milestoneEffects[tier],'milestone',theme);
 add(`${theme}-starter-background`,{cultivation:'Mistbound Peaks',garden:'Dewdrop Clearing',fantasy:'Quiet Forge',runway:'Atelier Morning',cyber:'Threadline Rooftop'}[theme],'background',0,0,'mountains','none','starter',theme);
 add(`${theme}-starter-hair`,{cultivation:'Bamboo Thread Pin',garden:'Leaflight Pin',fantasy:'Bronze Artisan Clasp',runway:'Pearl Seam Clip',cyber:'Signal Hair Clip'}[theme],'hair',0,0,'hairpin','none','starter',theme);
 add(`${theme}-starter-frame`,{cultivation:'Jade Rim',garden:'Vine Wreath',fantasy:'Guild Seal',runway:'Ivory Editorial Frame',cyber:'Interface Bracket'}[theme],'frame',0,0,'frame','none','starter',theme);
 add(`${theme}-starter-title`,{cultivation:'Thread Seeker',garden:'Keeper of Small Wonders',fantasy:'Maker of New Legends',runway:'An Original in Progress',cyber:'Maker // Online'}[theme],'title',0,0,'title','none','starter',theme);
 if(theme!=='cultivation') {
  const names={garden:['Thorn Needle','Firefly Satellites','Dewlight Aura','Petal Circle'],fantasy:['Crafting Staff','Orbiting Rune Shards','Hearthlight Aura','Novice Rune Ring'],runway:['Sculptural Scissors','Pearl Thread Satellites','Studio Spotlight','First Look Stage'],cyber:['Holographic Needle','Signal Drones','Soft Neon Field','Digital Stitch Ring']}[theme];
  ['main','orbit','aura','formation'].forEach((slot,i)=>add(`${theme}-starter-${slot}`,names[i],slot,0,0,[{garden:'thorn',fantasy:'staff',runway:'shears',cyber:'holo-needle'}[theme],'needle-array','aura','formation'][i],['needle-glint','theme-orbit','theme-aura','theme-ring'][i],'starter',theme));
  const advanced={garden:['Rosegold Thorn Staff','Moonpetal Satellites','Royal Petal Couture','Blooming Diadem','Moonflower Spirit','Elderflower Mandala','Starlit Conservatory','The Evergreen Artisan','Gilded Vine Wreath'],fantasy:['Enchanted Tailor Shears','Astral Crafting Shards','Runeforged Cloak','Starforge Circlet','Astral Artisan Spirit','Masterwork Rune Array','The Astral Workshop','Artisan of the Seventh Forge','Legendkeeper Frame'],runway:['Platinum Silhouette Shears','Orbiting Metallic Pearls','Sculptural Evening Couture','Gilded Thread Fascinator','Editorial Spotlight','Signature Halo Stage','The Gilded Runway','A Signature Beyond Seasons','Couture Gallery Frame'],cyber:['Prismatic Thread Staff','Neon Needle Satellites','Holographic Circuit Jacket','Neural Thread Crown','Overclock Filament Field','Quantum Stitch Matrix','Orbital Skyline','Thread Architect // Prime','Prismatic Interface']}[theme];
  Object.keys(SLOTS).forEach((slot,i)=>add(`${theme}-advanced-${slot}`,advanced[i],slot,5,[180,120,180,100,160,140,90,40,70][i],[{garden:'staff',fantasy:'shears',runway:'shears',cyber:'holo-staff'}[theme],'needle-array','mantle','crown','aura','formation','pavilion','title','frame'][i],['silk-ribbons','theme-orbit','mantle-flow','crown-strands','theme-advanced-aura','loom-rings','none','none','none'][i],'shop',theme,'','Legendary'));
 }
}
for(const [id,name,tier,cost,effect] of [
 ['quiet-chi','Quiet Chi',1,30,'quiet-chi'],['golden-core','Golden Core',3,120,'golden-core'],['lotus-soul','Lotus Soul',4,180,'lotus-soul'],['soul-transformation','Soul Transformation',5,240,'soul-transformation'],['immortal-weaver','Immortal Weaver',7,480,'immortal-weaver'],
]) add(id,name,'aura',tier,cost,'aura',effect,'shop','cultivation');
export const ITEM_BY_ID=Object.fromEntries(ITEMS.map(item=>[item.id,item]));
export function starterLoadout(theme) {
 const loadout=Object.fromEntries(ITEMS.filter(i=>i.themeId===theme&&i.acquisitionMethod==='starter').map(i=>[i.slot,i.id]));
 loadout.robe=`${theme}-milestone-0`;return loadout;
}
