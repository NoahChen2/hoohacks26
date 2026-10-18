import test from 'node:test';
import assert from 'node:assert/strict';

const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
const legacy={body:{height:170,chest:94,waist:80,hips:100,shoulder:43,arm:60,inseam:78,neck:37,thigh:57},garments:[{id:'old-item',name:'Keep me',type:'tshirt',chest:112}],selected:'old-item',tools:{scissors:true},tab:'body',legacySetting:'retain'};
const raw=JSON.stringify(legacy);storage.set('restitch.v1',raw);
const module=await import('../src/state.js?migration-test');

test('legacy guest migration preserves measurements, garment IDs and original storage',()=>{
  assert.deepEqual(module.state.body,legacy.body);assert.deepEqual(module.state.garments,legacy.garments);
  assert.equal(module.state.selected,'old-item');assert.equal(module.state.legacySetting,'retain');
  assert.equal(storage.get('restitch.v1'),raw,'loading does not overwrite stored data');
  assert.equal(module.state.character.bodyPreset,'feminine');
});

test('character settings persist locally and are included in existing cloud snapshots',async()=>{
  module.state.character.bodyPreset='masculine';module.state.character.proportions.calfVolume=.7;module.emit('character');
  await new Promise(resolve=>setTimeout(resolve,300));
  const saved=JSON.parse(storage.get('restitch.v1'));
  assert.equal(saved.character.bodyPreset,'masculine');assert.equal(saved.character.proportions.calfVolume,.7);
  assert.equal(module.snapshot().character.proportions.calfVolume,.7);
  assert.deepEqual(module.snapshot().garments,legacy.garments);
  module.replaceState(legacy);assert.equal(module.state.character.proportions.calfVolume,.7,'older snapshots do not erase new character settings');
  module.useStorage('account-one');module.replaceState({...legacy,character:{...module.state.character,bodyPreset:'feminine'}});
  assert.equal(JSON.parse(storage.get('restitch.v1.user.account-one')).character.bodyPreset,'feminine');
  assert.equal(JSON.parse(storage.get('restitch.v1')).character.bodyPreset,'masculine','account cache leaves guest data alone');
});
