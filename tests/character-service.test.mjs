import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterGeometryService } from '../src/character/service.js';
import { defaultCharacter } from '../src/character/settings.ts';

class FakeWorker {
  requests=[];
  postMessage(request){this.requests.push(request);}
  terminate(){this.terminated=true;}
  finish(){
    const request=this.requests.at(-1);
    this.onmessage({data:{id:request.id,positions:new Float32Array([0,0,0,1,0,0,0,1,0]),normals:new Float32Array([0,0,1,0,0,1,0,0,1]),uv:new Float32Array(6)}});
  }
}

test('geometry service coalesces requests, cancels obsolete pending work and reuses CPU meshes',async()=>{
  const original=globalThis.Worker;globalThis.Worker=FakeWorker;
  const service=new CharacterGeometryService(),b={height:172},a=defaultCharacter();
  try{
    const first=service.request(b,a);
    const pending=service.request({height:175},a);const cancelled=pending.catch(error=>error.message);
    assert.equal(service.request(b,a),first,'same active work is shared');
    assert.match(await cancelled,/Superseded/);
    service.worker.finish();const geometry=await first;
    assert.equal(service.worker.requests.length,1,'cancelled pending mesh is not generated');
    assert.equal(await service.request(b,a),geometry,'CPU original is reused');
    const active=service.request({height:180},a);
    const obsolete=service.request({height:185},a).catch(error=>error.message);
    assert.equal(await service.request(b,a),geometry,'cached latest request wins');assert.match(await obsolete,/Superseded/);
    service.worker.finish();await active;assert.equal(service.worker.requests.length,2);
    const failure=service.request({height:190},a).catch(error=>error.message);service.worker.onerror();
    assert.match(await failure,/could not run/);
    await assert.rejects(service.request(b,a),/unavailable/,'failed worker does not leave the viewer loading forever');
  }finally{service.dispose();globalThis.Worker=original;}
  assert.equal(service.worker.terminated,true);assert.equal(service.cache.size,0);
});
