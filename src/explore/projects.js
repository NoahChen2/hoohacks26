// Explore's categories and search. The projects themselves load from the
// server (./community.js); the launch catalog is seeded from supabase/seed-posts.mjs.
export const CATEGORIES = ['For You','Streetwear','Y2K','Vintage','Minimalist','Cottagecore','Beginner'];
export function filterProjects(query='',category='For You',savedOnly=false,saved=[],list=[]){
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(p=>(category==='For You'||p.aesthetic===category||p.difficulty===category)&&(!savedOnly||saved.includes(p.id))&&terms.every(term=>[p.title,p.username,p.description,p.difficulty,...p.tags,...p.materials].join(' ').toLowerCase().includes(term)));
}
