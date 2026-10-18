// Shared Explore posts as plain data: what a valid post is, and how a row from
// the Supabase `posts` table becomes a feed project. No network here.
export const POST_AESTHETICS=['Streetwear','Y2K','Vintage','Minimalist','Cottagecore'];
export const POST_DIFFICULTIES=['Beginner','Intermediate','Advanced'];
export const POST_TOOLS=['Needle and thread','Sewing machine','Fabric scissors','Iron','Measuring tape','Pins or clips','Seam ripper','Fabric glue'];
// Garment kinds the 3D try-on can draw (src/shell/tryOn.js KIND_SHAPES).
export const POST_KINDS=[['tee','T-shirt'],['shirt','Shirt'],['blouse','Blouse'],['cami','Cami or tank'],['crop','Crop top'],['hoodie','Hoodie'],['cardigan','Cardigan'],['jacket','Jacket'],['vest','Vest'],['dress','Dress'],['skirt','Skirt'],['jeans','Jeans'],['trousers','Trousers']];
const SAFETY=['Check the fabric condition before starting. Do not rework weak or damaged load-bearing areas.','Keep fingers clear of needles and blades, and follow your iron’s heat instructions.','This guide was shared by a community maker. Try on and baste before cutting, and adjust to your own measurements.'];
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IMAGE_PATH=/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
export const USERNAME=/^[a-z0-9._]{2,30}$/;

const lines=(text,max)=>String(text||'').split(/\r?\n/).map(line=>line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean).slice(0,max).map(line=>line.slice(0,300));
export const suggestUsername=email=>{const name=String(email||'').split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g,'').slice(0,30);return name.length>=2?name:'maker';};
export function estimatedTime(hours){if(hours<1)return `${Math.round(hours*60)} minutes`;return hours===1?'1 hour':`${hours} hours`;}

// Form fields to a row for the posts table. Throws a message meant for the person posting.
export function validatePost(fields){
  const title=String(fields.title||'').trim(),description=String(fields.description||'').trim(),username=String(fields.username||'').trim().toLowerCase(),hours=Number(fields.hours);
  if(!title)throw Error('Give your project a title.');
  if(title.length>120)throw Error('Keep the title under 120 characters.');
  if(description.length>2000)throw Error('Keep the description under 2,000 characters.');
  if(!USERNAME.test(username))throw Error('Your name on Explore needs 2–30 lowercase letters, numbers, dots or underscores.');
  if(!POST_AESTHETICS.includes(fields.aesthetic))throw Error('Choose a style.');
  if(!POST_DIFFICULTIES.includes(fields.difficulty))throw Error('Choose a skill level.');
  if(!Number.isFinite(hours)||hours<=0||hours>200)throw Error('Enter roughly how many hours it took (up to 200).');
  const steps=lines(fields.steps,30);if(!steps.length)throw Error('Add at least one step, one per line.');
  const kind=POST_KINDS.some(([id])=>id===fields.kind)?fields.kind:null;
  const tools=[...new Set((fields.tools||[]).filter(tool=>POST_TOOLS.includes(tool)))];
  return {title,description,username,aesthetic:fields.aesthetic,difficulty:fields.difficulty,hours:Math.round(hours*4)/4,kind,tools,materials:lines(fields.materials,30),steps};
}

// A posts row, as the project shape the feed, detail page and tutorial use.
// Returns null for a row that does not look like one this app wrote.
export function postToProject(row,coverUrl){
  if(!row||!UUID.test(row.id)||!IMAGE_PATH.test(row.image_path)||!USERNAME.test(row.username)||!POST_AESTHETICS.includes(row.aesthetic)||!POST_DIFFICULTIES.includes(row.difficulty)||!Array.isArray(row.steps)||!row.steps.length)return null;
  const width=Number(row.image_width),height=Number(row.image_height),hours=Number(row.hours)||1;
  const strings=list=>Array.isArray(list)?list.filter(item=>typeof item==='string'):[];
  const materials=strings(row.materials),hash=[...row.user_id||row.id].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  const kind=POST_KINDS.some(([id])=>id===row.kind)?row.kind:'project';
  return {id:`post-${row.id}`,postId:row.id,source:'community',title:String(row.title),description:String(row.description||''),username:row.username,aesthetic:row.aesthetic,difficulty:row.difficulty,kind,color:'Original',...(/^#[0-9a-f]{6}$/.test(row.color)&&{art:{cloth:row.color}}),steps:strings(row.steps),materials,tools:strings(row.tools),safetyNotes:SAFETY,hours,estimatedTime:estimatedTime(hours),likes:0,tags:[row.aesthetic,materials[0]].filter(Boolean),cover:coverUrl,photo:true,avatar:`/explore/creator-${hash%8}.svg`,height:width>0&&height>0?Math.round(400*height/width):520,createdAt:row.created_at};
}

export function friendlyError(error){
  const message=error?.message||String(error);
  if(error?.code==='PGRST205'||error?.code==='42P01'||/does not exist|schema cache|bucket not found/i.test(message))return 'Posting isn’t set up yet. Run supabase/schema.sql in the Supabase SQL editor.';
  if(/invalid login credentials/i.test(message))return 'That email and password don’t match.';
  if(/email not confirmed/i.test(message))return 'Confirm your email first (check your inbox), then sign in.';
  if(/already registered/i.test(message))return 'That email already has an account. Sign in instead.';
  if(/rate limit/i.test(message))return 'Too many attempts. Wait a minute and try again.';
  if(/row-level security|violates|jwt|jws/i.test(message))return 'Your session expired. Sign in again and repost.';
  return message;
}

