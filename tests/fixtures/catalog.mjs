// The launch catalog as Explore receives it from the server: each seed row with
// the id and created_at the database would give it, mapped to a feed project.
import {SEED_POSTS} from '../../supabase/seed-posts.mjs';
import {postToProject} from '../../src/explore/posts.js';
export const catalog=SEED_POSTS.map((row,i)=>postToProject({...row,id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,user_id:null,created_at:new Date(Date.UTC(2026,9,1,12)-i*3600000).toISOString()},row.image_path));
