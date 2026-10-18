// Original creator avatars for Explore (public/explore/creator-<0-7>.svg); posts
// pick one by index. Regenerate: node scripts/generate-explore-assets.mjs
import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/explore',{recursive:true});
// [background, clothing, trim]
const palettes=[['#d9e1d4','#526b5b','#eee3c8'],['#efdbd8','#bd737d','#f7eee0'],['#e7dfd0','#676e4a','#d6bc8b'],['#e3e4d8','#d9be70','#fff5cf'],['#dfc8b5','#a3513b','#e4bfa0'],['#d9dfdd','#eeebe2','#899e98'],['#ddd0da','#704650','#d5afbd'],['#cad5dd','#435b7a','#a8b8c6']];
for(let i=0;i<8;i++){
  const bg=palettes[i][0],skin=['#c98b66','#e5b995','#8b593e','#b77652'][i%4];
  writeFileSync(`public/explore/creator-${i}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bg}"/><path d="M7 64 Q8 43 32 43 Q57 43 57 64" fill="${palettes[i][1]}"/><path d="M15 30 Q12 7 32 8 Q54 7 50 34 L46 48 L17 48Z" fill="#3f302a"/><ellipse cx="32" cy="29" rx="13" ry="17" fill="${skin}"/><path d="M18 23 Q20 5 35 11 Q47 12 47 25 Q33 23 29 16 Q23 25 18 23" fill="#3f302a"/><path d="M25 30h2m10 0h2M29 39q3 2 6 0" stroke="#443228" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>`);
}
