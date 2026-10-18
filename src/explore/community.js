// Every Explore project comes from the Supabase `posts` table: the launch
// catalog (supabase/seed.sql) and what people share, whose photos live in the
// public `post-images` bucket. New posts stream to every open feed through Realtime.
import {getSupabase,supabaseEnabled} from '../supabase.js';
import {UUID,validatePost,postToProject,isBundledImage} from './posts.js';
export {POST_AESTHETICS,POST_DIFFICULTIES,POST_TOOLS,POST_KINDS,suggestUsername,friendlyError} from './posts.js';

export const communityEnabled=supabaseEnabled;
const TABLE='posts',BUCKET='post-images';
const publicUrl=(supabase,path)=>isBundledImage(path)?path:supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const toProject=(supabase,row)=>postToProject(row,publicUrl(supabase,row.image_path));

export async function loadPosts(){
  if(!communityEnabled)return [];
  const supabase=await getSupabase();
  const {data,error}=await supabase.from(TABLE).select('*').order('created_at',{ascending:false}).limit(300);
  if(error)throw error;
  return data.map(row=>toProject(supabase,row)).filter(Boolean);
}
// A project by its feed id: post-<uuid> for shared posts, the slug for the catalog.
export async function loadPost(projectId){
  const id=projectId.replace(/^post-/,''),bySlug=!projectId.startsWith('post-');
  if(!communityEnabled||(bySlug?!/^[a-z0-9-]{1,60}$/.test(id):!UUID.test(id)))return null;
  const supabase=await getSupabase();
  const {data,error}=await supabase.from(TABLE).select('*').eq(bySlug?'slug':'id',id).maybeSingle();
  if(error)throw error;
  return data?toProject(supabase,data):null;
}
// Calls onPost for every post anyone publishes while the page is open.
export function watchPosts(onPost){
  if(!communityEnabled)return ()=>{};
  let channel=null,stopped=false;
  getSupabase().then(supabase=>{
    if(stopped)return;
    channel=supabase.channel('explore-posts').on('postgres_changes',{event:'INSERT',schema:'public',table:TABLE},({new:row})=>{const project=toProject(supabase,row);if(project)onPost(project);}).subscribe();
  });
  return ()=>{stopped=true;channel?.unsubscribe();};
}

export async function currentUser(){
  if(!communityEnabled)return null;
  const {data}=await (await getSupabase()).auth.getSession();
  return data.session?.user||null;
}
// Signs in, or creates the account. Returns the user, or null when the new
// account must confirm its email first.
export async function signIn(email,password,create=false){
  const auth=(await getSupabase()).auth;
  const {data,error}=create?await auth.signUp({email,password,options:{emailRedirectTo:`${location.origin}/explore`}}):await auth.signInWithPassword({email,password});
  if(error)throw error;
  return data.session?.user||null;
}
export async function signOut(){await (await getSupabase()).auth.signOut();}

export async function publishPost(fields,image){
  const supabase=await getSupabase(),user=await currentUser();
  if(!user)throw Error('Sign in to post.');
  const post=validatePost(fields),path=`${user.id}/${globalThis.crypto.randomUUID()}.jpg`;
  const upload=await supabase.storage.from(BUCKET).upload(path,image.blob,{contentType:'image/jpeg',upsert:false});
  if(upload.error)throw upload.error;
  const {data,error}=await supabase.from(TABLE).insert({...post,user_id:user.id,image_path:path,image_width:image.width,image_height:image.height,color:image.color}).select().single();
  if(error){supabase.storage.from(BUCKET).remove([path]).catch(()=>{});throw error;}
  return toProject(supabase,data);
}

// Shrinks a photo to a feed-sized JPEG, crops extreme shapes so the masonry
// stays even, and samples the garment colour from the centre for the try-on.
export async function prepareImage(file){
  if(!file)throw Error('Add a photo of your project.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use a JPEG, PNG or WebP photo.');
  if(file.size>20*1024*1024)throw Error('That photo is over 20 MB. Choose a smaller one.');
  let bitmap;
  try{bitmap=await window.createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('That photo could not be read. Try another one.');}
  const ratio=Math.min(1.6,Math.max(0.75,bitmap.height/bitmap.width));
  let sw=bitmap.width,sh=Math.round(sw*ratio);
  if(sh>bitmap.height){sh=bitmap.height;sw=Math.round(sh/ratio);}
  const scale=Math.min(1,1200/sw),width=Math.round(sw*scale),height=Math.round(sh*scale);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');context.drawImage(bitmap,(bitmap.width-sw)/2,(bitmap.height-sh)/2,sw,sh,0,0,width,height);bitmap.close();
  const pixels=context.getImageData(Math.round(width*0.35),Math.round(height*0.35),Math.max(1,Math.round(width*0.3)),Math.max(1,Math.round(height*0.3))).data;
  const sum=[0,0,0];for(let i=0;i<pixels.length;i+=4){sum[0]+=pixels[i];sum[1]+=pixels[i+1];sum[2]+=pixels[i+2];}
  const count=pixels.length/4,color='#'+sum.map(v=>Math.round(v/count).toString(16).padStart(2,'0')).join('');
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('That photo could not be prepared.')),'image/jpeg',0.86));
  return {blob,width,height,color};
}
