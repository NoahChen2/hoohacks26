import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {parseAnalysisRequest,demoAnalysis,analyzeClothing,createAnalyzeHandler} from '../server/analyze.js';
import {ResultSchema,MAX_UPLOAD_BYTES,validateUpload} from '../src/studio/schema.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=';
const body=()=>({imageDataUrl:image,condition:'Minor wear',material:'Unknown',preferences:{aesthetics:['Y2K'],skill:'Beginner',tools:['None yet']}});
test('uploads enforce supported MIME, 5 MB, signatures, condition, and request shape',()=>{
 assert.equal(validateUpload({type:'image/png',size:MAX_UPLOAD_BYTES}),'');assert.ok(validateUpload({type:'image/png',size:MAX_UPLOAD_BYTES+1}));assert.ok(validateUpload({type:'image/svg+xml',size:100}));assert.ok(validateUpload(null));
 assert.equal(parseAnalysisRequest(body()).preferences.skill,'Beginner');
 for(const patch of [{imageDataUrl:'data:image/png;base64,ZmFrZQ=='},{imageDataUrl:image.replace('image/png','image/jpeg')},{condition:''},{material:'invented'},{apiKey:'bad'}])assert.throws(()=>parseAnalysisRequest({...body(),...patch}));
 const bytes=Buffer.alloc(MAX_UPLOAD_BYTES+1);bytes.set([137,80,78,71,13,10,26,10]);assert.throws(()=>parseAnalysisRequest({...body(),imageDataUrl:'data:image/png;base64,'+bytes.toString('base64')}),e=>e.status===413);
});
test('demo results are deterministic, honest, personalized and validate as exactly three complete projects',()=>{
 const input=parseAnalysisRequest(body()),a=demoAnalysis(input);assert.deepEqual(a,demoAnalysis(input));assert.equal(a.mode,'demo');assert.match(a.notice,/not analyzed/);assert.equal(a.analysis.fabricConfidence,'Unknown');assert.deepEqual(a.analysis.visibleColors,[]);
 assert.equal(a.analysis.projects.length,3);for(const p of a.analysis.projects){assert.deepEqual(p.aestheticTags,['Y2K']);assert.equal(p.difficulty,'Beginner');assert.deepEqual(p.tools,['None required']);assert.ok(p.instructions.length>=3);}
 const hand=demoAnalysis(parseAnalysisRequest({...body(),preferences:{tools:['Needle and thread'],aesthetics:['Vintage'],skill:'Advanced'}}));assert.match(hand.analysis.projects[0].tools.join(),/Needle/);assert.match(hand.analysis.projects[0].title,/Vintage/);
 assert.throws(()=>ResultSchema.parse({...a,analysis:{...a.analysis,projects:a.analysis.projects.slice(1)}}));
});
test('live path sends image and preferences server-side with configured model, validates output and never falls back on API failure',async()=>{
 const input=parseAnalysisRequest(body()),example=demoAnalysis(input).analysis;let called;
 const client={responses:{parse:async value=>{called=value;return {status:'completed',output_parsed:example};}}};
 const result=await analyzeClothing(input,{env:{OPENAI_API_KEY:'test-secret',OPENAI_VISION_MODEL:'configured-vision'},client});assert.equal(result.mode,'live');assert.equal(called.model,'configured-vision');assert.equal(called.store,false);assert.equal(called.input[0].content[1].image_url,image);assert.match(called.input[0].content[0].text,/Y2K/);assert.ok(called.text.format.schema);
 await assert.rejects(()=>analyzeClothing(input,{env:{OPENAI_API_KEY:'test-secret'},client}),e=>e.status===503);
 for(const response of [{status:'completed',output_parsed:null},{status:'incomplete',output_parsed:example},{status:'completed',output_parsed:{bad:true}}])await assert.rejects(()=>analyzeClothing(input,{env:{OPENAI_API_KEY:'test-secret',OPENAI_VISION_MODEL:'configured-vision'},client:{responses:{parse:async()=>response}}}));
 await assert.rejects(()=>analyzeClothing(input,{env:{OPENAI_API_KEY:'test-secret',OPENAI_VISION_MODEL:'configured-vision'},client:{responses:{parse:async()=>{throw Error('provider failure');}}}}));
});
test('HTTP endpoint returns demo, rejects invalid and oversized input, and hides provider errors and secrets',async()=>{
 const server=createServer(createAnalyzeHandler({env:{}}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
 const result=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body())});assert.equal(result.status,200);assert.equal((await result.json()).mode,'demo');assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(base)).status,405);assert.equal((await fetch(base,{method:'POST',body:'bad'})).status,415);assert.equal((await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
 assert.equal((await fetch(base,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://elsewhere.test'},body:JSON.stringify(body())})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
 const failing=createServer(createAnalyzeHandler({env:{OPENAI_API_KEY:'test-secret',OPENAI_VISION_MODEL:'configured-vision'},client:{responses:{parse:async()=>{throw Error('test-secret raw provider');}}}}));await new Promise(resolve=>failing.listen(0,'127.0.0.1',resolve));
 try{const result=await fetch(`http://127.0.0.1:${failing.address().port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body())});assert.equal(result.status,502);assert.doesNotMatch(await result.text(),/test-secret|raw provider/);}finally{await new Promise(resolve=>failing.close(resolve));}
});
test('live recommendations reject skill or equipment mismatches',async()=>{
 const input=parseAnalysisRequest(body()),analysis=demoAnalysis(input).analysis;
 for(const patch of [{difficulty:'Advanced'},{tools:['Sewing machine']},{tools:['Fabric scissors']}]){
  const output={...analysis,projects:analysis.projects.map((p,i)=>i===0?{...p,...patch}:p)};
  await assert.rejects(()=>analyzeClothing(input,{env:{OPENAI_API_KEY:'test-secret',OPENAI_VISION_MODEL:'configured-vision'},client:{responses:{parse:async()=>({status:'completed',output_parsed:output})}}}),e=>e.status===502);
 }
});
