import test from 'node:test';
import assert from 'node:assert/strict';
import {GARMENT_TYPES,garmentFields,dressOutfit,layerOrder,garmentFromSpec,defaultGarment,STARTER_PIECES} from '../src/garments.js';
import {localScan} from '../src/scan/localScan.js';
import {identifyClothing,createIdentifyHandler,parseIdentifyRequest,GEMINI_DEFAULT_MODELS,geminiThinking} from '../server/identify.js';

const body={height:172,chest:96,waist:80,hips:99,shoulder:44,arm:61,inseam:79,neck:38,thigh:57};
const PNG='data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(16)]).toString('base64');

test('an outfit keeps one piece per slot and dresses inside-out',()=>{
  const [jeans,tee,jacket,dress,skirt,hoodie]=['jeans','tshirt','jacket','dress','skirt','hoodie'].map(defaultGarment);
  let outfit=[jeans,tee,jacket].reduce(dressOutfit,[]);
  assert.deepEqual(layerOrder(outfit).map(g=>g.type),['jeans','tshirt','jacket']);
  outfit=dressOutfit(outfit,hoodie);
  assert.deepEqual(layerOrder(outfit).map(g=>g.type),['jeans','tshirt','hoodie','jacket'],'mid layers sit between base and outer');
  outfit=dressOutfit(outfit,dress);
  assert.deepEqual(layerOrder(outfit).map(g=>g.type),['dress','hoodie','jacket'],'a dress replaces both the top and the bottoms');
  outfit=dressOutfit(outfit,skirt);
  assert.deepEqual(layerOrder(outfit).map(g=>g.type),['skirt','hoodie','jacket'],'bottoms take a dress off');
  assert.equal(dressOutfit(outfit,skirt).length,3,'wearing a piece twice is a no-op');
});

test('garments from a spec are sized to the wearer and always within field ranges',()=>{
  for(const type of Object.keys(GARMENT_TYPES))for(const fit of ['fitted','regular','oversized',undefined])for(const length of ['cropped','long',undefined]){
    const g=garmentFromSpec({type,fit,length,sleeves:'long'},{...body,chest:140,waist:130,hips:150,arm:72});
    for(const [key,,min,max] of garmentFields(type))assert.ok(g[key]>=min&&g[key]<=max,`${type} ${key}=${g[key]}`);
  }
  const fitted=garmentFromSpec({type:'tshirt',fit:'fitted'},body),loose=garmentFromSpec({type:'tshirt',fit:'oversized'},body);
  assert.ok(fitted.chest<loose.chest&&fitted.chest>=body.chest,'fit words change the ease, never below the body');
  const junk=garmentFromSpec({type:'cape',color:'red',pattern:'zigzag',material:'kevlar',name:'  '});
  assert.equal(junk.type,'tshirt');assert.match(junk.color,/^#[0-9a-f]{6}$/);assert.equal(junk.pattern,'solid');assert.equal(junk.material,'cotton');assert.equal(junk.name,'T-shirt');
  assert.ok(STARTER_PIECES.length>=20&&STARTER_PIECES.every(s=>GARMENT_TYPES[s.type]));
  assert.deepEqual(new Set(STARTER_PIECES.map(s=>s.type)),new Set(Object.keys(GARMENT_TYPES)),'the starter rail covers every type');
});

// A synthetic photo: a background plus coloured rectangles.
function image(width,height,bg,rects){
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const hit=rects.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h),c=hit?(hit.color(x,y)):bg,i=(y*width+x)*4;
    data.set([...c,255],i);
  }
  return {data,width,height};
}
const solid=c=>()=>c;

test('on-device scan finds jeans by their legs, a two-piece outfit by its colours, and stripes',()=>{
  const denim=[70,100,150],white=[245,245,245];
  const jeans=localScan(image(64,96,white,[{x:16,y:8,w:32,h:30,color:solid(denim)},{x:16,y:38,w:14,h:50,color:solid(denim)},{x:34,y:38,w:14,h:50,color:solid(denim)}]));
  assert.equal(jeans.length,1);assert.equal(jeans[0].type,'jeans');assert.equal(jeans[0].material,'denim');assert.equal(jeans[0].pattern,'denim');
  const outfit=localScan(image(64,110,white,[{x:12,y:6,w:40,h:44,color:solid([190,40,45])},{x:16,y:50,w:14,h:54,color:solid([30,30,34])},{x:34,y:50,w:14,h:54,color:solid([30,30,34])},{x:16,y:50,w:32,h:12,color:solid([30,30,34])}]));
  assert.deepEqual(outfit.map(g=>GARMENT_TYPES[g.type].kind),['bottom','top'],'bottom first, top outermost');
  assert.match(outfit[1].name,/^Red/);
  const stripes=localScan(image(80,70,white,[{x:10,y:8,w:60,h:54,color:(x,y)=>Math.floor(y/4)%2?[30,42,80]:[236,224,196]}]));
  assert.equal(stripes[0].pattern,'stripes');
  for(const spec of [...jeans,...outfit,...stripes])for(const key of ['color','color2'])assert.match(spec[key],/^#[0-9a-f]{6}$/);
});

test('identify endpoint: demo without a key, validated live output, honest errors',async()=>{
  assert.throws(()=>parseIdentifyRequest({imageDataUrl:'data:text/plain;base64,aGk='}),/valid JPEG/);
  const demo=await identifyClothing(parseIdentifyRequest({imageDataUrl:PNG}),{env:{}});
  assert.equal(demo.mode,'demo');assert.deepEqual(demo.garments,[]);
  let sent;
  const client={responses:{parse:async request=>{sent=request;return {status:'completed',output_parsed:{notes:'',garments:[{type:'jacket',name:'Denim jacket',color:'#4B6FA0',color2:'#fff',pattern:'denim',material:'denim',fit:'relaxed',length:'regular',sleeves:'long',stains:false,holes:true}]}};}}};
  const live=await identifyClothing({imageDataUrl:PNG},{env:{OPENAI_API_KEY:'k',OPENAI_VISION_MODEL:'m'},client});
  assert.equal(sent.model,'m');assert.equal(sent.store,false);assert.equal(sent.input[0].content[1].image_url,PNG);
  assert.equal(live.mode,'live');assert.equal(live.garments[0].color,'#4b6fa0');assert.equal(live.garments[0].color2,'#ffffff');
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.status=code;},end(text){this.body=text;}};
  await createIdentifyHandler({env:{}})({method:'GET',headers:{}},res);
  assert.equal(res.status,405);
});

test('Gemini free tier scans the photo, falls back to the lite model when rate limited, and repairs colours',async()=>{
  const calls=[];
  const reply=(status,body)=>({ok:status<300,status,json:async()=>body});
  const scan={garments:[{type:'skirt',name:'Plaid mini skirt',color:'#8C2F39',color2:'#123',pattern:'plaid',material:'wool',fit:'regular',length:'cropped',sleeves:'none',stains:false,holes:false},{type:'cape',name:'x'}],notes:''};
  const fetchImpl=async(url,init)=>{calls.push({url,init:JSON.parse(init.body),key:init.headers['x-goog-api-key']});return calls.length===1?reply(429,{error:{status:'RESOURCE_EXHAUSTED'}}):reply(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(scan)}]}}]});};
  const result=await identifyClothing({imageDataUrl:PNG},{env:{GEMINI_API_KEY:' g-key ',OPENAI_API_KEY:'ignored'},fetchImpl});
  assert.deepEqual(calls.map(c=>c.url.match(/models\/([^:]+)/)[1]),GEMINI_DEFAULT_MODELS.slice(0,2));
  assert.equal(calls[0].key,'g-key');
  const part=calls[0].init.contents[0].parts[1].inline_data;
  assert.equal(part.mime_type,'image/png');assert.equal(`data:image/png;base64,${part.data}`,PNG);
  assert.equal(calls[0].init.generationConfig.responseMimeType,'application/json');
  assert.ok(calls[0].init.generationConfig.responseSchema.properties.garments.items.properties.type.enum.includes('cardigan'));
  assert.equal(result.mode,'live');assert.match(result.notice,/Gemini/);
  assert.equal(result.garments.length,1,'items outside the schema are dropped');
  assert.equal(result.garments[0].color,'#8c2f39');assert.equal(result.garments[0].color2,'#112233');
  const quota=async()=>reply(429,{});
  await assert.rejects(identifyClothing({imageDataUrl:PNG},{env:{GEMINI_API_KEY:'k'},fetchImpl:quota}),e=>e.status===429&&/quota/.test(e.message));
  const badKey=async()=>reply(400,{error:{status:'INVALID_ARGUMENT',details:[{reason:'API_KEY_INVALID'}]}});
  await assert.rejects(identifyClothing({imageDataUrl:PNG},{env:{GEMINI_API_KEY:'k'},fetchImpl:badKey}),/GEMINI_API_KEY/);
  // A custom model goes first; a rejected thinking level is retried without one.
  const custom=[];const empty=reply(200,{candidates:[{content:{parts:[{text:'{"garments":[],"notes":"No clothes here."}'}]}}]});
  const none=await identifyClothing({imageDataUrl:PNG},{env:{GEMINI_API_KEY:'k',GEMINI_MODEL:'gemini-3.6-flash'},fetchImpl:async(url,init)=>{custom.push([url,JSON.parse(init.body)]);return custom.length===1?reply(400,{error:{status:'INVALID_ARGUMENT',message:'Thinking level LOW is not supported for this model.'}}):empty;}});
  assert.match(custom[0][0],/gemini-3\.6-flash:generateContent$/);assert.deepEqual(custom[0][1].generationConfig.thinkingConfig,{thinkingLevel:'low'});
  assert.match(custom[1][0],/gemini-3\.6-flash:generateContent$/);assert.equal(custom[1][1].generationConfig.thinkingConfig,undefined);
  assert.deepEqual(none.garments,[]);assert.equal(none.notice,'No clothes here.');
  assert.deepEqual(geminiThinking('gemini-3.5-flash-lite'),{thinkingLevel:'minimal'});assert.deepEqual(geminiThinking('gemini-2.5-flash'),{thinkingBudget:0});assert.equal(geminiThinking('gemini-flash-latest'),null);
});
