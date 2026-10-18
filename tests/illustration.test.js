import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHARACTER_ART,ENVIRONMENT_ART,ARTIFACT_ART} from '../src/avatar/artManifest.js';
import {ITEMS} from '../src/avatar/items.js';
import {paintedItemFragment,atlasFragment} from '../src/avatar/paintedArt.js';

test('all seven production artwork files exist at their declared resolution',()=>{
 for(const atlas of [...Object.values(CHARACTER_ART),ENVIRONMENT_ART,ARTIFACT_ART]){const data=fs.readFileSync(new URL('../public'+atlas.src,import.meta.url));assert.equal(data.readUInt32BE(16),atlas.width);assert.equal(data.readUInt32BE(20),atlas.height);assert.ok(atlas.width>=1000);assert.ok(atlas.height>=1000);}
 for(const art of Object.values(CHARACTER_ART)){assert.equal(art.columns*art.rows,6);const data=fs.readFileSync(new URL('../public'+art.src,import.meta.url));assert.equal(data[25],6,'Character sprite atlases preserve alpha transparency');}
});
test('every cosmetic has painted preview artwork; atlas frames are independently clipped',()=>{
 for(const item of ITEMS)assert.match(paintedItemFragment(item),/<image[^>]*href="\/art\/manhwa\//,item.id);
 const first=atlasFragment(CHARACTER_ART.cultivation,0),second=atlasFragment(CHARACTER_ART.cultivation,1);
 assert.match(first,/<clipPath/);assert.match(second,/<rect x="418" y="0" width="418" height="627"/);assert.notEqual(first.match(/clipPath id="([^"]+)/)[1],second.match(/clipPath id="([^"]+)/)[1]);
});
